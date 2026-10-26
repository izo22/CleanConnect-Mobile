import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { openDb, run, type DB } from "./db.ts";
import { getAgent, newApiKey } from "./model.ts";
import { safeOutboundUrl } from "./hooks.ts";

process.env.NODE_ENV = "test";

let db: DB;
let pushed: Array<{ url: string; body: any }>;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  db = openDb(":memory:");
  pushed = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    pushed.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("{}", { status: String(url).includes("gone") ? 410 : 200 });
  }) as typeof fetch;
  app = buildApp({ db, fetchImpl });
  run(db, "INSERT INTO agents (id, name, autonomy, api_key, created_at) VALUES ('z', 'Zap', 0, ?, 0)", newApiKey());
});

const auth = () => ({ authorization: `Bearer ${getAgent(db, "z")!.api_key}` });
const flush = () => new Promise((r) => setTimeout(r, 30));

describe("REST hooks for Zapier", () => {
  it("only calls public https addresses", () => {
    delete process.env.ALLOW_PRIVATE_HOOKS;
    expect(safeOutboundUrl("https://hooks.zapier.com/hooks/standard/1/abc")).toBe(true);
    for (const bad of ["http://hooks.zapier.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://192.168.1.1/x", "https://169.254.169.254/latest", "ftp://x.com"]) {
      expect(safeOutboundUrl(bad), bad).toBe(false);
    }
  });

  it("refuses to subscribe a private address", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/hooks", headers: auth(), payload: { event: "decision", target_url: "https://127.0.0.1/steal" } });
    expect(res.statusCode).toBe(400);
  });

  it("pushes approved decisions with the kept data, respecting the filter", async () => {
    await app.inject({ method: "POST", url: "/api/v1/hooks", headers: auth(), payload: { event: "decision", target_url: "https://hooks.zapier.com/a", filter: { approved: true, action: "stripe.refund" } } });
    const ask = (await app.inject({ method: "POST", url: "/api/v1/check", headers: auth(), payload: { action: "stripe.refund", amount_cents: 34000, summary: "Refund $340", payload: { order: "8812" } } })).json();
    expect(ask).toMatchObject({ decision: "needs_approval", allowed: false, needs_approval: true });

    await app.inject({ method: "POST", url: `/api/approvals/${ask.approval_id}/decision`, payload: { approve: true } });
    await flush();
    expect(pushed).toEqual([{ url: "https://hooks.zapier.com/a", body: expect.objectContaining({ approved: true, amount: 340, payload: { order: "8812" } }) }]);

    const other = (await app.inject({ method: "POST", url: "/api/v1/check", headers: auth(), payload: { action: "email.send", summary: "Mail" } })).json();
    await app.inject({ method: "POST", url: `/api/approvals/${other.approval_id}/decision`, payload: { approve: true } });
    await flush();
    expect(pushed).toHaveLength(1); // different action: filtered out
  });

  it("pushes pause and resume, and drops a subscription the platform says is gone (410)", async () => {
    await app.inject({ method: "POST", url: "/api/v1/hooks", headers: auth(), payload: { event: "agent_state", target_url: "https://hooks.zapier.com/state" } });
    await app.inject({ method: "POST", url: "/api/v1/hooks", headers: auth(), payload: { event: "agent_state", target_url: "https://hooks.zapier.com/gone" } });
    await app.inject({ method: "POST", url: "/api/agents/z/actions/pause" });
    await flush();
    expect(pushed.find((p) => p.url.endsWith("/state"))!.body).toMatchObject({ paused: true, state: "paused" });
    expect((db.prepare("SELECT COUNT(*) n FROM hooks").get() as { n: number }).n).toBe(1);
  });
});
