import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { evaluateAgent } from "./engine.ts";
import { check, inQuietHours } from "./guard.ts";
import { HOUR, MINUTE, getAgent, newApiKey, type AgentRow } from "./model.ts";
import { classifyError } from "./translate.ts";
import { reviewPending, shouldSample, type Judge } from "./reviewer.ts";

process.env.NODE_ENV = "test";

// Monday 26 October 2026, 15:00 in Paris.
const NOW = Date.UTC(2026, 9, 26, 14, 0, 0);

function addAgent(db: DB, id: string, extra: Partial<AgentRow> = {}) {
  const a = { autonomy: 2, budget_cents: 100_000, expected_language: null, ...extra };
  run(
    db,
    `INSERT INTO agents (id, name, mission, owner_name, owner_email, autonomy, budget_cents, expected_language, api_key, created_at)
     VALUES (?, ?, '', 'Julie Martin', 'julie@exemple.fr', ?, ?, ?, ?, ?)`,
    id, id, a.autonomy, a.budget_cents, a.expected_language, newApiKey(), NOW - 30 * 24 * HOUR,
  );
  return getAgent(db, id)!;
}

function addRule(db: DB, id: string, kind: string, params: object, enabled = true) {
  run(db, "INSERT INTO rules (id, kind, label, params, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, kind, "remboursement", JSON.stringify(params), enabled ? 1 : 0, NOW);
}

function addEvent(db: DB, agentId: string, ts: number, e: { kind?: string; action?: string; target?: string; success?: boolean; cost?: number; language?: string; code?: string; message?: string }) {
  run(
    db,
    "INSERT INTO events (agent_id, ts, kind, action, target, success, cost_cents, language, error_code, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    agentId, ts, e.kind ?? "task", e.action ?? null, e.target ?? null, e.success === false ? 0 : 1, e.cost ?? 0, e.language ?? null, e.code ?? null, e.message ?? null,
  );
}

const openAlertKinds = (db: DB, agentId: string) =>
  (db.prepare("SELECT kind FROM alerts WHERE agent_id = ? AND status = 'open' ORDER BY kind").all(agentId) as Array<{ kind: string }>).map((r) => r.kind);

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("guard", () => {
  it("refuses everything while the agent is paused", () => {
    const a = addAgent(db, "a");
    run(db, "UPDATE agents SET paused = 1 WHERE id = 'a'");
    expect(check(db, getAgent(db, "a")!, { action: "email.send" }, NOW).decision).toBe("deny");
    expect(check(db, a, { action: "email.send" }, NOW).decision).toBe("allow");
  });

  it("asks for approval above an amount threshold and creates the request", () => {
    const a = addAgent(db, "a");
    addRule(db, "r", "approval_amount", { action_prefix: "stripe.refund", max_cents: 20000 });
    expect(check(db, a, { action: "stripe.refund", amount_cents: 15000 }, NOW).decision).toBe("allow");
    const res = check(db, a, { action: "stripe.refund", amount_cents: 34000, summary: "Rembourser 340 €" }, NOW);
    expect(res.decision).toBe("needs_approval");
    const row = get<{ title: string; status: string }>(db, "SELECT title, status FROM approvals");
    expect(row).toEqual({ title: "Rembourser 340 €", status: "pending" });
  });

  it("level 0 agents need approval for every action, level 1 only for sensitive ones", () => {
    const trainee = addAgent(db, "t", { autonomy: 0 });
    const confirmed = addAgent(db, "c", { autonomy: 1 });
    expect(check(db, trainee, { action: "email.send" }, NOW).decision).toBe("needs_approval");
    expect(check(db, confirmed, { action: "email.send" }, NOW).decision).toBe("allow");
    expect(check(db, confirmed, { action: "email.send", sensitive: true }, NOW).decision).toBe("needs_approval");
  });

  it("blocks e-mails during quiet hours, across midnight", () => {
    const p = { action_prefix: "email", start_hour: 22, end_hour: 7, timezone: "Europe/Paris" };
    expect(inQuietHours(p, Date.UTC(2026, 9, 26, 22, 30))).toBe(true); // 23:30 Paris
    expect(inQuietHours(p, Date.UTC(2026, 9, 26, 4, 0))).toBe(true); // 05:00 Paris
    expect(inQuietHours(p, Date.UTC(2026, 9, 26, 8, 0))).toBe(false); // 09:00 Paris
  });

  it("denies when the agent's monthly budget is spent", () => {
    const a = addAgent(db, "a", { budget_cents: 1000 });
    addEvent(db, "a", NOW - HOUR, { cost: 1200 });
    expect(check(db, a, { action: "x" }, NOW).decision).toBe("deny");
  });
});

describe("alert engine", () => {
  it("detects duplicate actions and auto-pauses when the rule is on", () => {
    addAgent(db, "a");
    addRule(db, "rp", "repeat_pause", { count: 10, window_min: 60 });
    for (let i = 0; i < 12; i++) {
      addEvent(db, "a", NOW - 30 * MINUTE + i, { kind: "action", action: "email.send", target: `c${i}` });
      addEvent(db, "a", NOW - 20 * MINUTE + i, { kind: "action", action: "email.send", target: `c${i}` });
    }
    evaluateAgent(db, "a", NOW);
    expect(openAlertKinds(db, "a")).toEqual(["duplicates"]);
    expect(getAgent(db, "a")!.paused).toBe(1);
  });

  it("translates expired credentials into a blocking alert, and closes it when work resumes", () => {
    addAgent(db, "a");
    for (let i = 0; i < 6; i++) addEvent(db, "a", NOW - 10 * MINUTE + i, { success: false, action: "hubspot.update", code: "401", message: "token expired" });
    evaluateAgent(db, "a", NOW);
    const alert = get<{ kind: string; severity: string; title: string }>(db, "SELECT kind, severity, title FROM alerts");
    expect(alert).toEqual({ kind: "auth", severity: "blocked", title: "N'arrive plus à se connecter à HubSpot" });

    const later = NOW + 40 * MINUTE;
    for (let i = 0; i < 8; i++) addEvent(db, "a", later - 5 * MINUTE + i, { action: "hubspot.update" });
    evaluateAgent(db, "a", later);
    expect(openAlertKinds(db, "a")).toEqual([]);
  });

  it("flags answers in the wrong language", () => {
    addAgent(db, "a", { expected_language: "fr" });
    for (let i = 0; i < 10; i++) addEvent(db, "a", NOW - HOUR + i, { language: "fr" });
    for (let i = 0; i < 8; i++) addEvent(db, "a", NOW - HOUR + 100 + i, { language: "en" });
    evaluateAgent(db, "a", NOW);
    expect(openAlertKinds(db, "a")).toEqual(["language"]);
  });

  it("does not reopen an alert from evidence older than its resolution", () => {
    addAgent(db, "a");
    for (let i = 0; i < 12; i++) {
      addEvent(db, "a", NOW - 30 * MINUTE + i, { kind: "action", action: "email.send", target: `c${i}` });
      addEvent(db, "a", NOW - 20 * MINUTE + i, { kind: "action", action: "email.send", target: `c${i}` });
    }
    evaluateAgent(db, "a", NOW);
    run(db, "UPDATE alerts SET status = 'resolved', resolved_at = ?", NOW);
    evaluateAgent(db, "a", NOW + MINUTE);
    expect(openAlertKinds(db, "a")).toEqual([]);
  });
});

describe("translation", () => {
  it("classifies common errors", () => {
    expect(classifyError("401", "Unauthorized")).toBe("auth");
    expect(classifyError(null, "429 Too Many Requests")).toBe("rate_limit");
    expect(classifyError("ETIMEDOUT", null)).toBe("timeout");
    expect(classifyError(null, "something odd")).toBe("unknown");
  });
});

describe("HTTP API", () => {
  it("runs the full loop: ingest → alert → one-click fix → agent sees it", async () => {
    const app = buildApp({ db, now: () => NOW });
    const a = addAgent(db, "a");
    run(db, "INSERT INTO prompt_versions (agent_id, version, content, active, created_at) VALUES ('a', 1, 'v1', 0, ?), ('a', 2, 'v2', 1, ?)", NOW - 48 * HOUR, NOW - 2 * HOUR);
    const auth = { authorization: `Bearer ${a.api_key}` };

    const events = Array.from({ length: 24 }, (_, i) => ({ kind: "action", action: "email.send", target: `c${i % 12}`, ts: NOW - 10 * MINUTE + i }));
    const ingest = await app.inject({ method: "POST", url: "/api/v1/events", headers: auth, payload: { events } });
    expect(ingest.statusCode).toBe(200);
    expect(ingest.json().accepted).toBe(24);

    const alerts = (await app.inject({ url: "/api/alerts" })).json();
    expect(alerts.open).toHaveLength(1);
    expect(alerts.open[0].actions.map((x: { id: string }) => x.id)).toEqual(["pause", "rollback", "handoff"]);

    const fix = await app.inject({ method: "POST", url: `/api/alerts/${alerts.open[0].id}/actions/rollback`, headers: { "x-user-name": "Isa" } });
    expect(fix.statusCode).toBe(200);

    const config = (await app.inject({ url: "/api/v1/config", headers: auth })).json();
    expect(config.prompt).toEqual({ version: 1, content: "v1" });
    expect((await app.inject({ url: "/api/alerts" })).json().open).toHaveLength(0);
  });

  it("lets an agent wait for a human decision", async () => {
    const app = buildApp({ db, now: () => NOW });
    const a = addAgent(db, "a", { autonomy: 0 });
    const auth = { authorization: `Bearer ${a.api_key}` };
    const res = (await app.inject({ method: "POST", url: "/api/v1/check", headers: auth, payload: { action: "quote.send", summary: "Devis 12 400 €" } })).json();
    expect(res.decision).toBe("needs_approval");

    const before = (await app.inject({ url: `/api/v1/approvals/${res.approval_id}`, headers: auth })).json();
    expect(before.status).toBe("pending");
    await app.inject({ method: "POST", url: `/api/approvals/${res.approval_id}/decision`, payload: { approve: true } });
    const after = (await app.inject({ url: `/api/v1/approvals/${res.approval_id}`, headers: auth })).json();
    expect(after.status).toBe("approved");

    const again = await app.inject({ method: "POST", url: `/api/approvals/${res.approval_id}/decision`, payload: { approve: false } });
    expect(again.statusCode).toBe(409);
  });

  it("rejects unknown agent keys and protects the dashboard with a token", async () => {
    const app = buildApp({ db, adminToken: "secret", now: () => NOW });
    expect((await app.inject({ method: "POST", url: "/api/v1/events", headers: { authorization: "Bearer nope" }, payload: { kind: "task" } })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/overview" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/overview", headers: { "x-admin-token": "secret" } })).statusCode).toBe(200);
  });

  it("validates input", async () => {
    const app = buildApp({ db, now: () => NOW });
    const a = addAgent(db, "a");
    const bad = await app.inject({ method: "POST", url: "/api/v1/events", headers: { authorization: `Bearer ${a.api_key}` }, payload: { kind: "nope" } });
    expect(bad.statusCode).toBe(400);
  });
});

describe("human reports and AI review", () => {
  it("turns a reported error into an alert, and closes the report when handled", async () => {
    const app = buildApp({ db, now: () => NOW });
    addAgent(db, "a");
    const res = await app.inject({ method: "POST", url: "/api/agents/a/reports", headers: { "x-user-name": "Karim" }, payload: { description: "TVA à 10 % au lieu de 20 %" } });
    expect(res.statusCode).toBe(201);
    const open = (await app.inject({ url: "/api/alerts" })).json().open;
    expect(open).toHaveLength(1);
    expect(open[0].title).toBe("Erreur signalée par Karim");
    expect(open[0].actions.map((x: { id: string }) => x.id)).toContain("dismiss");

    await app.inject({ method: "POST", url: `/api/alerts/${open[0].id}/actions/autonomy0` });
    expect(getAgent(db, "a")!.autonomy).toBe(0);
    expect(get<{ status: string }>(db, "SELECT status FROM reports")!.status).toBe("closed");
    evaluateAgent(db, "a", NOW + MINUTE);
    expect(openAlertKinds(db, "a")).toEqual([]);
  });

  it("samples answers at ingest, reviews them and raises a quality alert", async () => {
    const app = buildApp({ db, now: () => NOW });
    const a = addAgent(db, "a");
    run(db, "UPDATE agents SET review_rate = 1 WHERE id = 'a'");
    const events = Array.from({ length: 8 }, (_, i) => ({ kind: "task", input: `question ${i}`, output: `réponse ${i}`, ts: NOW - HOUR + i }));
    await app.inject({ method: "POST", url: "/api/v1/events", headers: { authorization: `Bearer ${a.api_key}` }, payload: { events } });
    expect(get<{ n: number }>(db, "SELECT COUNT(*) n FROM events WHERE review_state = 'pending'")!.n).toBe(8);

    // A fake judge: every answer mentioning an odd number is wrong.
    const seen: string[] = [];
    const judge: Judge = async (r) => {
      seen.push(r.output);
      const bad = Number(r.output.split(" ")[1]) % 2 === 1;
      return { verdict: bad ? "error" : "ok", score: bad ? 10 : 90, summary: bad ? "Réponse fausse." : "Correct.", issues: [] };
    };
    let total = 0;
    for (let i = 0; i < 3; i++) total += await reviewPending(db, judge, { limit: 4, reviewer: "test", now: () => NOW });
    expect(total).toBe(8);
    expect(seen).toHaveLength(8);
    expect(openAlertKinds(db, "a")).toEqual(["quality"]);

    // Humans can overrule the reviewer: dismissing false alarms clears the alert.
    const quality = (await app.inject({ url: "/api/quality" })).json();
    expect(quality.flagged).toHaveLength(4);
    for (const f of quality.flagged) await app.inject({ method: "POST", url: `/api/reviews/${f.review_id}/verdict`, payload: { confirmed: false } });
    expect(openAlertKinds(db, "a")).toEqual([]);
  });

  it("always reviews level-0 agents, never answers without output", () => {
    const trainee = addAgent(db, "t", { autonomy: 0 });
    expect(shouldSample(trainee, true, 0.99)).toBe(true);
    expect(shouldSample(trainee, false, 0)).toBe(false);
  });
});
