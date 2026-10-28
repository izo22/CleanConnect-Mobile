import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { addDefaultRules } from "./auth.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { getAgent, newApiKey } from "./model.ts";
import { aiPrecheck } from "./precheck.ts";
import type { Judge, Judgement } from "./reviewer.ts";

process.env.NODE_ENV = "test";

const NOW = Date.UTC(2026, 9, 28, 14, 0, 0);
const SOLAR_EMAIL = "Bonjour, toiture de 15 m² plein sud à Lyon (69003). Je voudrais 9 kWc. Cordialement, M. Dupont";
const QUOTE = "Devis n°482 : installation 9 kWc, 22 panneaux, 18 400 € TTC, pose sous 3 semaines.";

const verdict = (v: Judgement["verdict"], summary = "OK"): Judgement => ({ verdict: v, score: v === "ok" ? 95 : 30, summary, issues: v === "ok" ? [] : [{ type: "incorrect", detail: "9 kWc demandent environ 45 m², la toiture fait 15 m²." }] });

function setup(judge: Judge | null) {
  const db = openDb(":memory:");
  addDefaultRules(db, "main", NOW);
  const key = newApiKey();
  run(db, "INSERT INTO agents (id, name, mission, owner_name, owner_email, autonomy, budget_cents, api_key, created_at) VALUES ('quotes', 'Solar quotes', 'Answer quote requests', '', '', 2, 100000, ?, ?)", key, NOW);
  const calls: Array<Parameters<Judge>[0]> = [];
  const spy: Judge | null = judge && (async (r) => { calls.push(r); return judge(r); });
  const app = buildApp({ db, now: () => NOW, judge: spy });
  const ask = (body: object) => app.inject({ method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${key}` }, payload: { action: "quote.send", summary: "Quote for M. Dupont", ...body } });
  return { db, app, ask, calls };
}

const aiRule = (db: DB) => get<{ id: string; trigger_count: number; params: string }>(db, "SELECT id, trigger_count, params FROM rules WHERE kind = 'ai_check'")!;

describe("AI check before the action", () => {
  it("holds a doubtful answer for a human, with what the AI found and what was about to go out", async () => {
    const { db, ask, calls } = setup(async () => verdict("error", "La puissance demandée ne tient pas sur la toiture."));
    const res = (await ask({ input: SOLAR_EMAIL, output: QUOTE })).json();
    expect(res).toMatchObject({ decision: "needs_approval", allowed: false, needs_approval: true, reason: "AI check: La puissance demandée ne tient pas sur la toiture." });
    expect(calls[0]).toMatchObject({ agentName: "Solar quotes", action: "quote.send", input: SOLAR_EMAIL, output: QUOTE });

    const approval = get<{ status: string; reason: string; context: string }>(db, "SELECT status, reason, context FROM approvals WHERE id = ?", res.approval_id)!;
    expect(approval.status).toBe("pending");
    expect(approval.reason).toContain("the AI check found a problem");
    expect(approval.context).toContain("9 kWc demandent environ 45 m²");
    expect(approval.context).toContain(QUOTE);
    expect(aiRule(db).trigger_count).toBe(1);
  });

  it("lets a correct answer go out without bothering anyone", async () => {
    const { db, ask } = setup(async () => verdict("ok"));
    expect((await ask({ input: SOLAR_EMAIL, output: QUOTE })).json()).toMatchObject({ decision: "allow", allowed: true });
    expect(get(db, "SELECT COUNT(*) n FROM approvals")).toEqual({ n: 0 });
  });

  it("only reads when the agent sends what it is about to send", async () => {
    const { ask, calls } = setup(async () => verdict("error"));
    expect((await ask({ input: SOLAR_EMAIL })).json().decision).toBe("allow");
    expect(calls).toHaveLength(0);
  });

  it("fails closed: if the AI can't answer, a human decides", async () => {
    const { ask } = setup(async () => { throw new Error("overloaded"); });
    const res = (await ask({ output: QUOTE })).json();
    expect(res).toMatchObject({ decision: "needs_approval", reason: "AI check unavailable: human approval required." });
  });

  it("fails closed when the AI takes too long", async () => {
    const { db } = setup(null);
    const slow: Judge = () => new Promise(() => {});
    const res = await aiPrecheck(db, getAgent(db, "quotes")!, { action: "quote.send", output: QUOTE }, slow, NOW, 30);
    expect(res).toMatchObject({ decision: "needs_approval" });
  });

  it("can hold only what is clearly wrong, or be turned off", async () => {
    const { db, ask } = setup(async () => verdict("doubt", "Délai de pose non confirmé."));
    run(db, "UPDATE rules SET params = ? WHERE kind = 'ai_check'", JSON.stringify({ action_prefix: "*", hold_on: "error" }));
    expect((await ask({ output: QUOTE })).json().decision).toBe("allow");

    run(db, "UPDATE rules SET params = ? WHERE kind = 'ai_check'", JSON.stringify({ action_prefix: "*", hold_on: "doubt" }));
    expect((await ask({ output: QUOTE })).json().decision).toBe("needs_approval");

    run(db, "UPDATE rules SET enabled = 0 WHERE kind = 'ai_check'");
    expect((await ask({ output: QUOTE })).json().decision).toBe("allow");
  });

  it("applies only to the actions the rule names", async () => {
    const { db, ask, calls } = setup(async () => verdict("error"));
    run(db, "UPDATE rules SET params = ? WHERE kind = 'ai_check'", JSON.stringify({ action_prefix: "quote.", hold_on: "doubt" }));
    expect((await ask({ action: "email.send", output: "Merci pour votre message." })).json().decision).toBe("allow");
    expect(calls).toHaveLength(0);
    expect((await ask({ action: "quote.send", output: QUOTE })).json().decision).toBe("needs_approval");
  });

  it("never runs when another guardrail already decided, or without an AI key", async () => {
    const paused = setup(async () => verdict("ok"));
    run(paused.db, "UPDATE agents SET paused = 1");
    expect((await paused.ask({ output: QUOTE })).json().decision).toBe("deny");
    expect(paused.calls).toHaveLength(0);

    const noKey = setup(null);
    expect((await noKey.ask({ output: QUOTE })).json().decision).toBe("allow");
    // The guardrails page says the check can't run without the key.
    const rule = (await noKey.app.inject({ url: "/api/rules" })).json().find((r: { kind: string }) => r.kind === "ai_check");
    expect(rule).toMatchObject({ enabled: true, unavailable: true, sentence: "AI check of every outgoing message before it goes out: anything doubtful waits for a human" });
  });
});
