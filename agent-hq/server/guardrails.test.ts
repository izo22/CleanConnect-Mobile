import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { ensureMainRules } from "./auth.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { getAgent, getRules } from "./model.ts";
import { aiPrecheck } from "./precheck.ts";
import type { Judge, ReviewInput } from "./reviewer.ts";

process.env.NODE_ENV = "test";

let db: DB;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  db = openDb(":memory:");
  ensureMainRules(db, Date.now());
  app = buildApp({ db });
});

const newAgent = async (name: string) => (await app.inject({ method: "POST", url: "/api/agents", payload: { name, autonomy: 2 } })).json() as { id: string; api_key: string };
const ask = (key: string, payload: object) => app.inject({ method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${key}` }, payload }).then((r) => r.json());
const addRule = (payload: object) => app.inject({ method: "POST", url: "/api/rules", payload });

describe("rules the owner adds", () => {
  it("“over an amount, I approve” works for any action, not only refunds", async () => {
    const quotes = await newAgent("Devis");
    expect((await addRule({ kind: "approval_amount", max_cents: 1_000_000 })).statusCode).toBe(201);
    expect((await ask(quotes.api_key, { action: "quote.send", amount_cents: 300_000 })).decision).toBe("allow");
    const big = await ask(quotes.api_key, { action: "quote.send", amount_cents: 1_840_000, summary: "Devis Durand" });
    expect(big.decision).toBe("needs_approval");
  });

  it("“at most this much per day” lets small amounts through until the day's total is reached", async () => {
    const refunds = await newAgent("Paiements");
    await addRule({ kind: "daily_total", max_cents: 100_000 });
    expect((await ask(refunds.api_key, { action: "supplier.pay", amount_cents: 40_000 })).decision).toBe("allow");
    expect((await ask(refunds.api_key, { action: "supplier.pay", amount_cents: 40_000 })).decision).toBe("allow");
    const third = await ask(refunds.api_key, { action: "supplier.pay", amount_cents: 40_000 });
    expect(third.decision).toBe("needs_approval");
    expect(get<{ reason: string }>(db, "SELECT reason FROM approvals WHERE id = ?", third.approval_id)!.reason).toMatch(/1[\s,.]?200/);
    // A refused request doesn't count; an approved one does.
    await app.inject({ method: "POST", url: `/api/approvals/${third.approval_id}/decision`, payload: { approve: true } });
    expect((await ask(refunds.api_key, { action: "supplier.pay", amount_cents: 1_000 })).decision).toBe("needs_approval");
  });

  it("a rule can cover only some agents", async () => {
    const quotes = await newAgent("Devis");
    const support = await newAgent("Support");
    const rule = (await addRule({ kind: "approval_amount", max_cents: 10_000, agents: [quotes.id] })).json();
    expect(rule.params.agents).toEqual([quotes.id]);
    expect((await ask(quotes.api_key, { action: "x", amount_cents: 50_000 })).decision).toBe("needs_approval");
    expect((await ask(support.api_key, { action: "x", amount_cents: 50_000 })).decision).toBe("allow");

    // The built-in refund rule can be limited too.
    const accounting = await newAgent("Compta");
    expect((await app.inject({ method: "PATCH", url: "/api/rules/main:refunds", payload: { params: { agents: [support.id] } } })).statusCode).toBe(200);
    expect((await ask(accounting.api_key, { action: "stripe.refund", amount_cents: 30_000 })).decision).toBe("allow");
    expect((await ask(support.api_key, { action: "stripe.refund", amount_cents: 30_000 })).decision).toBe("needs_approval");
  });

  it("refuses agents of another workspace, and keeps built-in rules", async () => {
    run(db, "INSERT INTO workspaces (id, name, created_at) VALUES ('other', 'Other', 0)");
    run(db, "INSERT INTO agents (id, workspace_id, name, mission, owner_name, owner_email, platform, autonomy, budget_cents, access, api_key, created_at) VALUES ('stranger', 'other', 'S', '', '', '', 'x', 2, 100, '[]', 'ahq_s', 0)");
    expect((await addRule({ kind: "daily_total", max_cents: 100, agents: ["stranger"] })).statusCode).toBe(400);

    expect((await app.inject({ method: "DELETE", url: "/api/rules/main:refunds" })).statusCode).toBe(400);
    const added = (await addRule({ kind: "daily_total", max_cents: 100 })).json();
    expect(added.deletable).toBe(true);
    expect((await app.inject({ method: "DELETE", url: `/api/rules/${encodeURIComponent(added.id)}` })).statusCode).toBe(200);
    expect(getRules(db, "main").some((r) => r.id === added.id)).toBe(false);
  });
});

describe("rules the owner writes in their own words", () => {
  it("are given to the AI, and a message breaking one waits for a human", async () => {
    const quotes = await newAgent("Devis");
    const added = await addRule({ kind: "written", text: "Ne jamais promettre une remise de plus de 10 %" });
    expect(added.statusCode).toBe(201);
    expect(added.json()).toMatchObject({ kind: "written", sentence: "Ne jamais promettre une remise de plus de 10 %", deletable: true });
    let seen: ReviewInput | null = null;
    const judge: Judge = async (input) => { seen = input; return { verdict: "error", score: 20, summary: "Remise de 25 % promise", issues: [] }; };
    const res = await aiPrecheck(db, getAgent(db, quotes.id)!, { action: "email.send", output: "Bonjour, je vous fais 25 % de remise." }, judge, Date.now());
    expect(seen!.instructions).toContain("Ne jamais promettre une remise de plus de 10 %");
    expect(res?.decision).toBe("needs_approval");
  });

  it("still apply when the general AI check is off, and only for the agents chosen", async () => {
    const quotes = await newAgent("Devis");
    const support = await newAgent("Support");
    await app.inject({ method: "PATCH", url: "/api/rules/main:ai-check", payload: { enabled: false } });
    await addRule({ kind: "written", text: "Toujours vouvoyer", agents: [quotes.id] });
    const judge: Judge = async () => ({ verdict: "error", score: 10, summary: "Tutoiement", issues: [] });
    expect((await aiPrecheck(db, getAgent(db, quotes.id)!, { action: "email.send", output: "Salut, ça va ?" }, judge, Date.now()))?.decision).toBe("needs_approval");
    expect(await aiPrecheck(db, getAgent(db, support.id)!, { action: "email.send", output: "Salut, ça va ?" }, judge, Date.now())).toBeNull();
  });

  it("must say something, in one sentence", async () => {
    expect((await addRule({ kind: "written", text: "   " })).statusCode).toBe(400);
    expect((await addRule({ kind: "written", text: "x".repeat(501) })).statusCode).toBe(400);
  });
});
