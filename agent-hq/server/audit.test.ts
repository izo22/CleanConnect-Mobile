import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { appendAudit, backfillAudit, fingerprint, GENESIS, verifyAudit } from "./audit.ts";
import { ensureMainRules } from "./auth.ts";
import { MAIN_WORKSPACE, get, openDb, run, type DB } from "./db.ts";
import { logActivity } from "./model.ts";

process.env.NODE_ENV = "test";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
});

const three = () => {
  for (const s of ["Approved: refund $340", "Rule changed: over $5,000, I approve", "Agent paused: Invoice Reminders"]) {
    appendAudit(db, MAIN_WORKSPACE, { ts: 1_000, kind: "activity", actor: "Dana", summary: s });
  }
};

describe("the tamper-evident record", () => {
  it("chains every entry to the one before", () => {
    three();
    const check = verifyAudit(db, MAIN_WORKSPACE);
    expect(check).toMatchObject({ ok: true, entries: 3 });
    const first = get<{ prev_hash: string; hash: string }>(db, "SELECT prev_hash, hash FROM audit_log WHERE seq = 1")!;
    expect(first.prev_hash).toBe(GENESIS);
    expect(get<{ prev_hash: string }>(db, "SELECT prev_hash FROM audit_log WHERE seq = 2")!.prev_hash).toBe(first.hash);
    expect(check.last_hash).toBe(get<{ hash: string }>(db, "SELECT hash FROM audit_log WHERE seq = 3")!.hash);
  });

  it("names the entry that was changed after the fact", () => {
    three();
    run(db, "UPDATE audit_log SET actor = 'Paul' WHERE seq = 2");
    expect(verifyAudit(db, MAIN_WORKSPACE)).toMatchObject({ ok: false, broken_at: 2, problem: "changed" });
  });

  it("notices a removed entry", () => {
    three();
    run(db, "DELETE FROM audit_log WHERE seq = 2");
    expect(verifyAudit(db, MAIN_WORKSPACE)).toMatchObject({ ok: false, broken_at: 2, problem: "missing" });
  });

  it("notices a rewritten entry even when its own fingerprint was recomputed", () => {
    three();
    const e = get<{ seq: number; ts: number; kind: "activity"; actor: string; agent_id: null; summary: string; data: null; prev_hash: string }>(
      db, "SELECT seq, ts, kind, actor, agent_id, summary, data, prev_hash FROM audit_log WHERE seq = 2",
    )!;
    const forged = { ...e, actor: "Paul" };
    run(db, "UPDATE audit_log SET actor = 'Paul', hash = ? WHERE seq = 2", fingerprint(e.prev_hash, MAIN_WORKSPACE, forged));
    expect(verifyAudit(db, MAIN_WORKSPACE)).toMatchObject({ ok: false, broken_at: 3, problem: "reordered" });
  });

  it("keeps one chain per workspace", () => {
    run(db, "INSERT INTO workspaces (id, name, created_at) VALUES ('other', 'Other', 0)");
    three();
    appendAudit(db, "other", { ts: 1, kind: "activity", actor: "Sam", summary: "Hello" });
    expect(verifyAudit(db, "other")).toMatchObject({ ok: true, entries: 1 });
    expect(verifyAudit(db, MAIN_WORKSPACE)).toMatchObject({ ok: true, entries: 3 });
  });

  it("starts with the log lines written before it existed, once", () => {
    run(db, "INSERT INTO activity (ts, actor, agent_id, message, workspace_id) VALUES (1, 'Dana', NULL, 'Old line A', ?), (2, 'Sam', NULL, 'Old line B', ?)", MAIN_WORKSPACE, MAIN_WORKSPACE);
    expect(backfillAudit(db)).toBe(2);
    expect(backfillAudit(db)).toBe(0);
    expect(verifyAudit(db, MAIN_WORKSPACE)).toMatchObject({ ok: true, entries: 2 });
  });

  it("receives every line of the log", () => {
    logActivity(db, "Dana", "Approved: refund $340", null, 5);
    const row = get<{ kind: string; actor: string; summary: string }>(db, "SELECT kind, actor, summary FROM audit_log WHERE workspace_id = ?", MAIN_WORKSPACE)!;
    expect(row).toEqual({ kind: "activity", actor: "Dana", summary: "Approved: refund $340" });
  });
});

describe("the record through the API", () => {
  it("records each permission check and each human decision, and verifies them", async () => {
    ensureMainRules(db, Date.now());
    const app = buildApp({ db });
    const agent = (await app.inject({ method: "POST", url: "/api/agents", payload: { name: "Quotes", autonomy: 0 } })).json() as { id: string; api_key: string };
    const asked = (await app.inject({
      method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${agent.api_key}` },
      payload: { action: "quote.send", amount_cents: 1_840_000, summary: "Send a $18,400 quote to Dana Brooks" },
    })).json();
    expect(asked.decision).toBe("needs_approval");
    await app.inject({ method: "POST", url: `/api/approvals/${asked.approval_id}/decision`, payload: { approve: true } });

    const res = (await app.inject({ method: "GET", url: "/api/audit" })).json();
    expect(res.check.ok).toBe(true);
    const check = res.entries.find((e: { kind: string }) => e.kind === "check");
    expect(check.summary).toContain("Send a $18,400 quote to Dana Brooks");
    expect(JSON.parse(check.data)).toMatchObject({ action: "quote.send", decision: "needs_approval", approval_id: asked.approval_id });
    expect(res.entries.some((e: { summary: string }) => e.summary.includes("Approved: Send a $18,400 quote"))).toBe(true);

    const exp = await app.inject({ method: "GET", url: "/api/audit/export" });
    expect(exp.headers["content-disposition"]).toMatch(/attachment; filename="orvanta-record-/);
    expect(exp.json().entries.length).toBe(res.check.entries);
  });
});
