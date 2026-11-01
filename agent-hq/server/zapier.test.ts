import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { getAgent } from "./model.ts";

process.env.NODE_ENV = "test";

let db: DB;
let app: ReturnType<typeof buildApp>;
let posted: Array<{ url: string; body: Record<string, unknown> }>;
let key: string;

beforeEach(async () => {
  db = openDb(":memory:");
  posted = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    posted.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  app = buildApp({ db, fetchImpl });
  key = (await app.inject({ method: "POST", url: "/api/zapier/key" })).json().key;
});

/** A call made by a Zap: the workspace's Zapier key, and the agent named in the step. */
const zap = (method: "GET" | "POST" | "DELETE", url: string, agent?: string, payload?: object) =>
  app.inject({ method, url, payload, headers: { authorization: `Bearer ${key}`, ...(agent ? { "x-agent": encodeURIComponent(agent) } : {}) } });
const settle = () => new Promise((r) => setTimeout(r, 30));

describe("one Zapier key for the whole workspace", () => {
  it("connects as the workspace, and each Zap becomes an agent by its name", async () => {
    expect(key).toMatch(/^ozk_/);
    expect((await zap("GET", "/api/v1/config")).json()).toMatchObject({ workspace: true, name: "Orvanta · Main workspace" });

    const ask = await zap("POST", "/api/v1/check", "Devis panneaux solaires", { action: "email.send", summary: "Devis Durand" });
    expect(ask.statusCode).toBe(200);
    const agent = getAgent(db, "zap-devis-panneaux-solaires")!;
    expect(agent).toMatchObject({ name: "Devis panneaux solaires", source: "zapier", platform: "Zapier", workspace_id: "main" });

    // Same name (any case), or the id picked from Zapier's list: same agent.
    await zap("POST", "/api/v1/events", "devis PANNEAUX solaires", { kind: "task", action: "email.send" });
    await zap("POST", "/api/v1/events", agent.id, { kind: "task", action: "email.send" });
    expect(get<{ n: number }>(db, "SELECT COUNT(*) n FROM agents WHERE source = 'zapier'")!.n).toBe(1);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) n FROM events WHERE agent_id = ?", agent.id)!.n).toBe(2);

    expect((await zap("GET", "/api/v1/agents")).json()).toContainEqual({ id: agent.id, name: "Devis panneaux solaires" });
    // Looking things up never creates an agent.
    await zap("GET", "/api/v1/agents", "Half-typed na");
    expect(getAgent(db, "zap-half-typed-na")).toBeUndefined();
  });

  it("refuses a step without an agent, a wrong key, and only the owner makes the key", async () => {
    expect((await zap("POST", "/api/v1/check", undefined, { action: "x" })).statusCode).toBe(400);
    const wrong = await app.inject({ method: "GET", url: "/api/v1/config", headers: { authorization: "Bearer ozk_nope" } });
    expect(wrong.statusCode).toBe(401);

    const old = key;
    key = (await app.inject({ method: "POST", url: "/api/zapier/key" })).json().key;
    const stale = await app.inject({ method: "GET", url: "/api/v1/config", headers: { authorization: `Bearer ${old}` } });
    expect(stale.statusCode).toBe(401);
    expect((await zap("GET", "/api/v1/config")).statusCode).toBe(200);
  });

  it("a Zap that fails reports it, and its agent shows the failure", async () => {
    await zap("POST", "/api/v1/events", "Relances factures", { kind: "error", action: "Gmail · Send Email", error_message: "Invalid recipient" });
    const e = get<{ success: number; error_message: string }>(db, "SELECT success, error_message FROM events WHERE agent_id = 'zap-relances-factures'");
    expect(e).toEqual({ success: 0, error_message: "Invalid recipient" });
  });
});

describe("Ask Permission waits in the Zap", () => {
  it("the Zap resumes as soon as a human decides, even if the decision came first", async () => {
    const ask = (await zap("POST", "/api/v1/check", "Remboursements", { action: "stripe.refund", summary: "Refund 340", require_approval: true })).json();
    expect(ask.decision).toBe("needs_approval");
    const cb = "https://hooks.zapier.com/hooks/callback/123/abc";
    expect((await zap("POST", `/api/v1/approvals/${ask.approval_id}/callback`, "Remboursements", { callback_url: cb })).statusCode).toBe(200);
    await app.inject({ method: "POST", url: `/api/approvals/${ask.approval_id}/decision`, payload: { approve: true } });
    await settle();
    expect(posted.find((p) => p.url === cb)?.body).toMatchObject({ approved: true, decision: "approved" });

    // Decided before Zapier registered where to call back: delivered at once.
    const late = (await zap("POST", "/api/v1/check", "Remboursements", { action: "stripe.refund", summary: "Refund 99", require_approval: true })).json();
    await app.inject({ method: "POST", url: `/api/approvals/${late.approval_id}/decision`, payload: { approve: false } });
    const cb2 = "https://hooks.zapier.com/hooks/callback/124/def";
    await zap("POST", `/api/v1/approvals/${late.approval_id}/callback`, "Remboursements", { callback_url: cb2 });
    await settle();
    expect(posted.find((p) => p.url === cb2)?.body).toMatchObject({ approved: false, decision: "rejected" });
  });

  it("only for a request of this workspace, and only to a public https address", async () => {
    const ask = (await zap("POST", "/api/v1/check", "Remboursements", { action: "x", require_approval: true })).json();
    expect((await zap("POST", `/api/v1/approvals/${ask.approval_id}/callback`, "Remboursements", { callback_url: "http://10.0.0.1/x" })).statusCode).toBe(400);
    run(db, "INSERT INTO workspaces (id, name, created_at) VALUES ('other', 'Other', 0)");
    run(db, "UPDATE agents SET workspace_id = 'other' WHERE id = 'zap-remboursements'");
    expect((await zap("POST", `/api/v1/approvals/${ask.approval_id}/callback`, "Elsewhere", { callback_url: "https://hooks.zapier.com/x" })).statusCode).toBe(404);
  });
});

describe("one subscription for every agent", () => {
  it("pausing any agent of the workspace reaches the emergency-stop Zap, with the agent's name", async () => {
    await zap("POST", "/api/v1/events", "Devis", { kind: "task" });
    const sub = await zap("POST", "/api/v1/hooks", undefined, { event: "agent_state", target_url: "https://hooks.zapier.com/hooks/standard/1/pause" });
    expect(sub.statusCode).toBe(201);
    await app.inject({ method: "POST", url: "/api/agents/zap-devis/actions/pause" });
    await settle();
    expect(posted.find((p) => p.url.endsWith("/pause"))?.body).toMatchObject({ agent_name: "Devis", state: "paused" });

    expect((await zap("DELETE", `/api/v1/hooks/${sub.json().id}`)).statusCode).toBe(200);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) n FROM workspace_hooks")!.n).toBe(0);
  });
});

describe("links shared by the administrator", () => {
  it("are shown to every workspace, https only", async () => {
    expect((await app.inject({ method: "PUT", url: "/api/admin/zapier-links", payload: { invite_url: "http://zapier.com/x" } })).statusCode).toBe(400);
    await app.inject({ method: "PUT", url: "/api/admin/zapier-links", payload: { invite_url: "https://zapier.com/developer/public-invite/1/abc/", monitor_url: "https://zapier.com/shared/xyz" } });
    const view = (await app.inject({ method: "GET", url: "/api/zapier" })).json();
    expect(view.links).toEqual({ invite_url: "https://zapier.com/developer/public-invite/1/abc/", monitor_url: "https://zapier.com/shared/xyz" });
    expect(view.key).toBe(key);
  });
});
