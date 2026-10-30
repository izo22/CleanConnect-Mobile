import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { all, get, openDb, type DB } from "./db.ts";
import { getAgent } from "./model.ts";
import { gateNames, insertGate, stepsOf } from "./n8n-protect.ts";
import type { N8nNode, N8nWorkflow } from "./n8n.ts";

process.env.NODE_ENV = "test";

const N8N = "http://n8n.test";

const node = (name: string, type: string, x: number): N8nNode => ({ name, type, typeVersion: 1, position: [x, 0], parameters: {} });
const quoteWorkflow = (): N8nWorkflow => ({
  id: "wf1", name: "Solar quotes", active: true, settings: { executionOrder: "v1", binaryMode: "x" },
  nodes: [node("Webhook", "n8n-nodes-base.webhook", 0), node("Prepare quote", "n8n-nodes-base.set", 220), node("Send quote", "n8n-nodes-base.httpRequest", 440)],
  connections: {
    Webhook: { main: [[{ node: "Prepare quote", type: "main", index: 0 }]] },
    "Prepare quote": { main: [[{ node: "Send quote", type: "main", index: 0 }]] },
  },
});

/** An n8n public API holding full workflows, which refuses to rewrite a published one. */
function fakeN8n() {
  const state = { workflows: [quoteWorkflow()], calls: [] as string[], puts: [] as Array<Record<string, unknown>>, canUpdate: true };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const path = url.pathname.slice("/api/v1".length);
    state.calls.push(`${method} ${path}`);
    if (path === "/workflows") return json(200, { data: state.workflows.map(({ id, name, active }) => ({ id, name, active })), nextCursor: null });
    if (path === "/executions") return json(200, { data: [], nextCursor: null });
    const m = path.match(/^\/workflows\/(\w+)(?:\/(activate|deactivate))?$/);
    const wf = m && state.workflows.find((w) => w.id === m[1]);
    if (!wf) return json(404, { message: "not found" });
    if (m[2]) {
      wf.active = m[2] === "activate";
      return json(200, wf);
    }
    if (method === "PUT") {
      if (!state.canUpdate) return json(403, { message: "Forbidden" });
      if (wf.active) return json(400, { message: "Deactivate the workflow first" });
      const body = JSON.parse(String(init!.body));
      state.puts.push(body);
      Object.assign(wf, { nodes: body.nodes, connections: body.connections });
      return json(200, wf);
    }
    return json(200, wf);
  }) as typeof fetch;
  return { state, fetchImpl };
}

let db: DB;
let fake: ReturnType<typeof fakeN8n>;
let app: ReturnType<typeof buildApp>;
const agent = "n8n-1-wf1";

beforeEach(async () => {
  db = openDb(":memory:");
  fake = fakeN8n();
  app = buildApp({ db, fetchImpl: fake.fetchImpl });
  await app.inject({ method: "POST", url: "/api/integrations", payload: { base_url: N8N, api_key: "good-key-123" } });
});

const protect = (payload: Record<string, unknown>) => app.inject({ method: "POST", url: `/api/agents/${agent}/n8n/protect`, payload });

describe("which steps can be protected", () => {
  it("not the trigger, not a step fed by several others, and a protected step says so", () => {
    const wf = quoteWorkflow();
    wf.nodes!.push(node("Merge", "n8n-nodes-base.merge", 660));
    wf.connections!.Webhook.main![0]!.push({ node: "Merge", type: "main", index: 0 });
    wf.connections!["Send quote"] = { main: [[{ node: "Merge", type: "main", index: 1 }]] };
    expect(stepsOf(wf).map((s) => [s.name, s.protectable])).toEqual([["Webhook", false], ["Prepare quote", true], ["Send quote", true], ["Merge", false]]);

    const gated = { ...wf, ...insertGate(wf, "Send quote", { always: true }, { orvantaUrl: "https://hq.test", agentKey: "k" }) };
    const send = stepsOf(gated).find((s) => s.name === "Send quote")!;
    expect(send).toMatchObject({ protected: true, protectable: false });
    // The inserted nodes are not listed as steps of their own.
    expect(stepsOf(gated)).toHaveLength(4);
  });
});

describe("inserting the check", () => {
  it("puts the check between the step and what fed it, and makes room on the canvas", () => {
    const wf = quoteWorkflow();
    const next = insertGate(wf, "Send quote", { always: true }, { orvantaUrl: "https://hq.test/", agentKey: "ahq_key" });
    const N = gateNames("Send quote");
    expect(next.nodes).toHaveLength(10);
    expect(next.connections["Prepare quote"].main![0]).toEqual([{ node: N.ask, type: "main", index: 0 }]);
    expect(next.connections[N.cont].main![0]).toEqual([{ node: "Send quote", type: "main", index: 0 }]);
    expect(next.nodes.find((n) => n.name === "Send quote")!.position[0]).toBeGreaterThan(next.nodes.find((n) => n.name === N.cont)!.position[0]);
    expect(next.nodes.find((n) => n.name === "Prepare quote")!.position).toEqual([220, 0]);

    const ask = next.nodes.find((n) => n.name === N.ask)!.parameters as Record<string, unknown>;
    expect(ask.url).toBe("https://hq.test/api/v1/check");
    expect(JSON.stringify(ask.headerParameters)).toContain("Bearer ahq_key");
    expect(ask.jsonBody).toContain('action: "n8n.send-quote"');
    expect(ask.jsonBody).toContain("callback_url: $execution.resumeUrl");
    expect(ask.jsonBody).toContain("require_approval: true");
    // The step gets back the items that reached the check, not Orvanta's answer.
    expect((next.nodes.find((n) => n.name === N.cont)!.parameters as { jsCode: string }).jsCode).toContain('$("Prepare quote").itemMatching(i)');
    // The original is left untouched.
    expect(wf.nodes).toHaveLength(3);
  });

  it("sends the amount when a field is chosen, and lets the guardrails decide", () => {
    const next = insertGate(quoteWorkflow(), "Send quote", { always: false, amountField: "total ttc" }, { orvantaUrl: "https://hq.test", agentKey: "k" });
    const body = (next.nodes.find((n) => n.name === gateNames("Send quote").ask)!.parameters as { jsonBody: string }).jsonBody;
    expect(body).toContain('amount_cents: Math.round(Number($json["total ttc"]) * 100) || undefined');
    expect(body).not.toContain("require_approval");
  });
});

describe("protecting a step from Orvanta", () => {
  it("lists the steps, rewrites the published workflow in the order n8n accepts, and can undo it", async () => {
    const steps = (await app.inject({ method: "GET", url: `/api/agents/${agent}/n8n/steps` })).json();
    expect(steps.steps.map((s: { name: string }) => s.name)).toEqual(["Webhook", "Prepare quote", "Send quote"]);
    expect(steps.can_undo).toBe(false);

    fake.state.calls.length = 0;
    const res = await protect({ step: "Send quote", always: true });
    expect(res.statusCode).toBe(200);
    expect(fake.state.calls).toEqual(["GET /workflows/wf1", "POST /workflows/wf1/deactivate", "PUT /workflows/wf1", "POST /workflows/wf1/activate"]);
    expect(fake.state.workflows[0]).toMatchObject({ active: true });
    expect(fake.state.workflows[0].nodes).toHaveLength(10);
    // Settings n8n's API doesn't accept are not sent back.
    expect(fake.state.puts[0].settings).toEqual({ executionOrder: "v1" });
    expect(get<{ n: number }>(db, "SELECT COUNT(*) n FROM workflow_backups WHERE agent_id = ?", agent)!.n).toBe(1);

    const again = await protect({ step: "Send quote", always: true });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toMatch(/already protected/);
    expect((await protect({ step: "Webhook", always: true })).statusCode).toBe(409);

    const listed = (await app.inject({ method: "GET", url: `/api/agents/${agent}/n8n/steps` })).json();
    expect(listed.steps.find((s: { name: string }) => s.name === "Send quote").protected).toBe(true);
    expect(listed.can_undo).toBe(true);

    expect((await app.inject({ method: "POST", url: `/api/agents/${agent}/n8n/undo` })).statusCode).toBe(200);
    expect(fake.state.workflows[0].nodes!.map((n) => n.name)).toEqual(["Webhook", "Prepare quote", "Send quote"]);
    expect(fake.state.workflows[0].active).toBe(true);
    expect((await app.inject({ method: "POST", url: `/api/agents/${agent}/n8n/undo` })).statusCode).toBe(409);
  });

  it("“above an amount” becomes a guardrail on the Guardrails page", async () => {
    expect((await protect({ step: "Send quote", always: false, amount_field: "amount", max_amount: 5000 })).statusCode).toBe(200);
    const rules = all<{ kind: string; label: string; params: string }>(db, "SELECT kind, label, params FROM rules WHERE kind = 'approval_amount' AND label = 'Send quote'");
    expect(rules).toHaveLength(1);
    expect(JSON.parse(rules[0].params)).toEqual({ action_prefix: "n8n.send-quote", max_cents: 500000 });

    const key = getAgent(db, agent)!.api_key;
    const ask = (amount_cents: number) => app.inject({ method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${key}` }, payload: { action: "n8n.send-quote", amount_cents } }).then((r) => r.json().decision);
    expect(await ask(320000)).toBe("allow");
    expect(await ask(1840000)).toBe("needs_approval");
  });

  it("a key without the right to change workflows gets a clear message, and the workflow stays published", async () => {
    fake.state.canUpdate = false;
    const res = await protect({ step: "Send quote", always: true });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain("workflow:update");
    expect(fake.state.workflows[0]).toMatchObject({ active: true });
    expect(fake.state.workflows[0].nodes).toHaveLength(3);
  });
});

describe("a step that always asks", () => {
  it("waits for a human whatever the guardrails say", async () => {
    const key = getAgent(db, agent)!.api_key;
    const res = (await app.inject({ method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${key}` }, payload: { action: "n8n.send-quote", summary: "Send quote · Solar quotes", require_approval: true } })).json();
    expect(res).toMatchObject({ decision: "needs_approval", needs_approval: true });
    expect(get<{ title: string }>(db, "SELECT title FROM approvals WHERE id = ?", res.approval_id)!.title).toBe("Send quote · Solar quotes");
  });
});
