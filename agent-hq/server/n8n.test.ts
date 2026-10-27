import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { getAgent } from "./model.ts";
import { controlLevel } from "./n8n.ts";
import { n8nSnippet } from "./n8n-template.ts";

process.env.NODE_ENV = "test";

const N8N = "http://n8n.test";

/** A small in-memory n8n public API, enough for the integration. */
function fakeN8n() {
  const state = {
    workflows: [
      { id: "wf1", name: "Remboursements", active: true },
      { id: "wf2", name: "Synchro HubSpot", active: true },
    ],
    executions: [] as Array<Record<string, unknown>>,
    calls: [] as string[],
    callbacks: [] as Array<{ url: string; body: unknown }>,
    down: false,
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    state.calls.push(`${method} ${url.pathname}`);
    if (!url.pathname.startsWith("/api/v1/")) {
      state.callbacks.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
      return json(200, {});
    }
    if (state.down) throw new TypeError("fetch failed");
    if ((init?.headers as Record<string, string>)["X-N8N-API-KEY"] !== "good-key-123") return json(401, { message: "unauthorized" });
    const path = url.pathname.slice("/api/v1".length);
    if (path === "/workflows") return json(200, { data: state.workflows, nextCursor: null });
    const m = path.match(/^\/workflows\/(\w+)\/(activate|deactivate)$/);
    if (m) {
      const wf = state.workflows.find((w) => w.id === m[1])!;
      wf.active = m[2] === "activate";
      return json(200, wf);
    }
    if (path === "/executions") return json(200, { data: [...state.executions].reverse(), nextCursor: null });
    const e = path.match(/^\/executions\/(\d+)$/);
    if (e) return json(200, state.executions.find((x) => String(x.id) === e[1]));
    return json(404, { message: "not found" });
  }) as typeof fetch;
  return { state, fetchImpl };
}

let db: DB;
let fake: ReturnType<typeof fakeN8n>;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  db = openDb(":memory:");
  fake = fakeN8n();
  app = buildApp({ db, fetchImpl: fake.fetchImpl });
});

const connect = () => app.inject({ method: "POST", url: "/api/integrations", payload: { base_url: N8N, api_key: "good-key-123" } });
const agentId = (wf: string) => `n8n-1-${wf}`;

describe("n8n integration", () => {
  it("refuses a wrong key without saving anything", async () => {
    const res = await app.inject({ method: "POST", url: "/api/integrations", payload: { base_url: N8N, api_key: "wrong-key-123" } });
    expect(res.statusCode).toBe(502);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) n FROM integrations")!.n).toBe(0);
  });

  it("imports workflows as agents and failed executions as a plain-language alert, once", async () => {
    const now = Date.now();
    for (let i = 1; i <= 6; i++) {
      fake.state.executions.push({
        id: i, workflowId: "wf2", status: "error", startedAt: new Date(now - 60_000).toISOString(), stoppedAt: new Date(now - 59_000).toISOString(),
        data: { resultData: { error: { message: "Authorization failed - please check your credentials", httpCode: "401", node: { name: "HubSpot · contact", type: "n8n-nodes-base.httpRequest" } } } },
      });
    }
    const res = await connect();
    expect(res.statusCode).toBe(201);
    expect(res.json().sync).toEqual({ workflows: 2, created: 2, imported: 6 });
    expect(getAgent(db, agentId("wf1"))!.source).toBe("n8n");

    const alert = get<{ kind: string; title: string }>(db, "SELECT kind, title FROM alerts WHERE agent_id = ?", agentId("wf2"));
    expect(alert).toEqual({ kind: "auth", title: "Can no longer connect to HubSpot · contact" });

    const again = await app.inject({ method: "POST", url: "/api/integrations/1/sync" });
    expect(again.json().sync.imported).toBe(0);
  });

  it("pausing an n8n agent deactivates the workflow first; if n8n is down nothing changes", async () => {
    await connect();
    const ok = await app.inject({ method: "POST", url: `/api/agents/${agentId("wf1")}/actions/pause` });
    expect(ok.statusCode).toBe(200);
    expect(fake.state.workflows[0].active).toBe(false);
    expect(getAgent(db, agentId("wf1"))!.paused).toBe(1);

    fake.state.down = true;
    const ko = await app.inject({ method: "POST", url: `/api/agents/${agentId("wf1")}/actions/resume` });
    expect(ko.statusCode).toBe(502);
    expect(getAgent(db, agentId("wf1"))!.paused).toBe(1);
  });

  it("re-enforces a pause decided in Orvanta if someone reactivates the workflow in n8n", async () => {
    await connect();
    await app.inject({ method: "POST", url: `/api/agents/${agentId("wf1")}/actions/pause` });
    fake.state.workflows[0].active = true;
    await app.inject({ method: "POST", url: "/api/integrations/1/sync" });
    expect(fake.state.workflows[0].active).toBe(false);
  });

  it("shows a workflow switched off in n8n as paused, with the reason", async () => {
    await connect();
    fake.state.workflows[1].active = false;
    await app.inject({ method: "POST", url: "/api/integrations/1/sync" });
    expect(getAgent(db, agentId("wf2"))).toMatchObject({ paused: 1, pause_reason: "switched off in n8n" });
  });

  it("wakes the waiting workflow with the human decision", async () => {
    await connect();
    run(db, "INSERT INTO rules (id, kind, label, params, enabled, created_at) VALUES ('r', 'approval_amount', 'remboursement', ?, 1, 0)", JSON.stringify({ action_prefix: "stripe.refund", max_cents: 20000 }));
    const key = getAgent(db, agentId("wf1"))!.api_key;
    const auth = { authorization: `Bearer ${key}` };

    const foreign = await app.inject({ method: "POST", url: "/api/v1/check", headers: auth, payload: { action: "stripe.refund", amount_cents: 34000, callback_url: "http://evil.test/x" } });
    expect(foreign.statusCode).toBe(400);

    const resumeUrl = `${N8N}/webhook-waiting/42?signature=abc`;
    const res = (await app.inject({ method: "POST", url: "/api/v1/check", headers: auth, payload: { action: "stripe.refund", amount_cents: 34000, summary: "Rembourser 340 €", callback_url: resumeUrl } })).json();
    expect(res.decision).toBe("needs_approval");

    await app.inject({ method: "POST", url: `/api/approvals/${res.approval_id}/decision`, payload: { approve: true } });
    await new Promise((r) => setTimeout(r, 50));
    expect(fake.state.callbacks).toEqual([{ url: resumeUrl, body: expect.objectContaining({ approved: true, decision: "approved" }) }]);
    expect(get<{ callback_status: string }>(db, "SELECT callback_status FROM approvals WHERE id = ?", res.approval_id)!.callback_status).toBe("sent");
  });
});

describe("control level shown to the user", () => {
  it("never claims more than what is wired", () => {
    expect(controlLevel({ source: "sdk", last_check_at: null }).level).toBe("watch");
    expect(controlLevel({ source: "n8n", last_check_at: null }).level).toBe("stop");
    expect(controlLevel({ source: "n8n", last_check_at: Date.now() }).level).toBe("control");
  });

  it("produces a pasteable n8n block that stops on errors and waits for the decision", () => {
    const s = n8nSnippet("https://hq.example.fr/", "ahq_key");
    const ask = s.nodes.find((n) => n.name === "Orvanta · Ask for permission")!;
    expect(ask.parameters).toMatchObject({ url: "https://hq.example.fr/api/v1/check" });
    expect(JSON.stringify(ask.parameters)).toContain("$execution.resumeUrl");
    expect(s.nodes.find((n) => n.type === "n8n-nodes-base.wait")!.parameters).toMatchObject({ resume: "webhook", httpMethod: "POST" });
  });
});

describe("alert actions on n8n agents", () => {
  it("pauses the workflow from an alert, and never touches n8n for a refused action", async () => {
    const now = Date.now();
    for (let i = 1; i <= 6; i++) {
      fake.state.executions.push({ id: i, workflowId: "wf2", status: "error", startedAt: new Date(now - 60_000).toISOString(), stoppedAt: new Date(now - 59_000).toISOString(),
        data: { resultData: { error: { message: "429 Too Many Requests", node: { name: "API", type: "n8n-nodes-base.httpRequest" } } } } });
    }
    await connect();
    const alert = get<{ id: number }>(db, "SELECT id FROM alerts WHERE agent_id = ?", agentId("wf2"))!;
    const ok = await app.inject({ method: "POST", url: `/api/alerts/${alert.id}/actions/pause` });
    expect(ok.statusCode).toBe(200);
    expect(fake.state.workflows[1].active).toBe(false);

    const calls = fake.state.calls.length;
    const again = await app.inject({ method: "POST", url: `/api/alerts/${alert.id}/actions/pause` });
    expect(again.statusCode).toBe(409);
    expect(fake.state.calls.length).toBe(calls);
    expect(fake.state.workflows[1].active).toBe(false);
  });
});
