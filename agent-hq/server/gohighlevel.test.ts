import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { getAgent } from "./model.ts";
import { toCents } from "./gohighlevel.ts";

process.env.NODE_ENV = "test";

let db: DB;
let app: ReturnType<typeof buildApp>;
let posted: Array<{ url: string; body: Record<string, unknown> }>;
let key: string;

const CONTINUE = "https://services.leadconnectorhq.com/hooks/loc123/webhook-trigger/abc";

beforeEach(async () => {
  db = openDb(":memory:");
  posted = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    posted.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  app = buildApp({ db, fetchImpl });
  key = (await app.inject({ method: "POST", url: "/api/gohighlevel/key" })).json().key;
});

/** What a GoHighLevel "Webhook" action sends: the contact, the sub-account, the workflow, custom data. */
const contactPayload = (customData: Record<string, unknown> = {}) => ({
  contact_id: "c-42",
  first_name: "Dana",
  last_name: "Brooks",
  full_name: "Dana Brooks",
  email: "dana@example.com",
  phone: "+15550100",
  location: { id: "loc-1", name: "Bright Dental" },
  workflow: { id: "wf-9", name: "Quote follow-up" },
  customData,
});
const ghl = (path: string, payload: object, query = "") =>
  app.inject({ method: "POST", url: `/api/v1/ghl/${key}/${path}${query}`, payload });
const settle = () => new Promise((r) => setTimeout(r, 30));

describe("GoHighLevel webhooks", () => {
  it("turns each workflow into an agent named after the sub-account, and records activity and failures", async () => {
    expect(key).toMatch(/^ogh_/);
    const ok = await ghl("activity", contactPayload({ action: "sms.send" }));
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, agent: "Bright Dental · Quote follow-up", paused: false });
    const agent = getAgent(db, "ghl-bright-dental-quote-follow-up")!;
    expect(agent).toMatchObject({ source: "ghl", platform: "GoHighLevel", external_id: "wf-9", workspace_id: "main" });

    // A failure, with its settings in the URL instead of the custom data.
    await ghl("activity", contactPayload(), "?status=failure&error=Twilio%20number%20suspended&action=sms.send");
    const events = db.prepare("SELECT kind, success, action, target, error_message, meta FROM events WHERE agent_id = ? ORDER BY id").all(agent.id) as Array<Record<string, unknown>>;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "task", success: 1, action: "sms.send", target: "Dana Brooks" });
    expect(events[1]).toMatchObject({ kind: "error", success: 0, error_message: "Twilio number suspended" });
    expect(JSON.parse(String(events[0].meta))).toMatchObject({ contact_id: "c-42", location_id: "loc-1", workflow_name: "Quote follow-up" });

    // The same workflow calling again: still one agent. An explicit name wins.
    await ghl("activity", contactPayload());
    await ghl("activity", contactPayload({ agent: "Reactivation campaign" }));
    expect(get<{ n: number }>(db, "SELECT COUNT(*) n FROM agents WHERE source = 'ghl'")!.n).toBe(2);
  });

  it("accepts form posts and a Custom Webhook body with an orvanta object", async () => {
    const form = await app.inject({
      method: "POST", url: `/api/v1/ghl/${key}/activity`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "agent=Form%20flow&action=email.send&email=lee%40example.com",
    });
    expect(form.statusCode).toBe(200);
    expect(form.json().agent).toBe("Form flow");
    const custom = await ghl("activity", { orvanta: { agent: "Custom flow", action: "crm.update" }, contact: { id: "c-7", email: "x@example.com" } });
    expect(custom.json().agent).toBe("Custom flow");
  });

  it("refuses an unknown or replaced key", async () => {
    expect((await app.inject({ method: "POST", url: "/api/v1/ghl/ogh_nope_nope_nope_nope_nope/activity", payload: {} })).statusCode).toBe(401);
    const old = key;
    key = (await app.inject({ method: "POST", url: "/api/gohighlevel/key" })).json().key;
    expect((await app.inject({ method: "POST", url: `/api/v1/ghl/${old}/activity`, payload: {} })).statusCode).toBe(401);
    expect((await ghl("activity", contactPayload())).statusCode).toBe(200);
  });

  it("asks permission, then wakes the next workflow with the decision and the contact", async () => {
    const res = await ghl("check", contactPayload({ action: "quote.send", summary: "Send the $18,400 quote", amount: "18,400.00", always_ask: "true", continue_url: CONTINUE }));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ decision: "needs_approval", needs_approval: true, agent: "Bright Dental · Quote follow-up" });
    const ap = get<{ id: number; amount_cents: number; callback_url: string; title: string }>(db, "SELECT id, amount_cents, callback_url, title FROM approvals WHERE id = ?", body.approval_id)!;
    expect(ap).toMatchObject({ amount_cents: 1_840_000, callback_url: CONTINUE, title: "Send the $18,400 quote" });
    expect(posted).toHaveLength(0);

    const decided = await app.inject({ method: "POST", url: `/api/approvals/${ap.id}/decision`, payload: { approve: true } });
    expect(decided.statusCode).toBe(200);
    await settle();
    const call = posted.find((p) => p.url === CONTINUE)!;
    expect(call.body).toMatchObject({ approved: true, contact_id: "c-42", email: "dana@example.com", first_name: "Dana", location_id: "loc-1" });
  });

  it("wakes the next workflow right away when the rules decide, and refuses while the agent is paused", async () => {
    const allowed = await ghl("check", contactPayload({ action: "sms.send", continue_url: CONTINUE }));
    expect(allowed.json()).toMatchObject({ decision: "allow", allowed: true });
    await settle();
    expect(posted.at(-1)!.body).toMatchObject({ approved: true, automatic: true, contact_id: "c-42", action: "sms.send" });

    run(db, "UPDATE agents SET paused = 1, pause_reason = 'by Isaac' WHERE id = 'ghl-bright-dental-quote-follow-up'");
    const refused = await ghl("check", contactPayload({ action: "sms.send", continue_url: CONTINUE }));
    expect(refused.json()).toMatchObject({ decision: "deny", allowed: false });
    await settle();
    expect(posted.at(-1)!.body).toMatchObject({ approved: false, decision: "rejected", automatic: true });
  });

  it("only calls back public https addresses", async () => {
    const res = await ghl("check", contactPayload({ action: "sms.send", continue_url: "http://169.254.169.254/latest" }));
    expect(res.statusCode).toBe(400);
  });

  it("reads amounts the way people type them", () => {
    expect(toCents("18,400.00")).toBe(1_840_000);
    expect(toCents("$1250")).toBe(125_000);
    expect(toCents(99.5)).toBe(9_950);
    expect(toCents("")).toBeUndefined();
    expect(toCents("abc")).toBeUndefined();
  });

  it("shows the key and the followed workflows on the Connections page", async () => {
    await ghl("activity", contactPayload());
    const view = (await app.inject({ method: "GET", url: "/api/gohighlevel" })).json();
    expect(view.key).toBe(key);
    expect(view.workflows).toEqual([expect.objectContaining({ name: "Bright Dental · Quote follow-up" })]);
  });
});
