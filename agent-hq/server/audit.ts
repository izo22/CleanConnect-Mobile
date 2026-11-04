/**
 * The tamper-evident record ("registre infalsifiable").
 *
 * Every entry carries the fingerprint (SHA-256) of the entry before it, per
 * workspace. Changing, removing or reordering any past entry breaks the chain
 * from that point on, and verification names the first entry that no longer
 * matches. The latest fingerprint summarises the whole history: write it down
 * or download the record, and any later rewrite becomes visible.
 */
import { createHash } from "node:crypto";
import { MAIN_WORKSPACE, all, get, run, type DB } from "./db.ts";

/** What the chain starts from, in every workspace. */
export const GENESIS = "orvanta-audit-genesis";

export type AuditKind = "activity" | "check";

export interface AuditEntry {
  seq: number;
  ts: number;
  kind: AuditKind;
  actor: string;
  agent_id: string | null;
  summary: string;
  data: string | null;
  prev_hash: string;
  hash: string;
}

/** The fingerprint covers every field, in a fixed order. */
export function fingerprint(prev: string, ws: string, e: Omit<AuditEntry, "prev_hash" | "hash">): string {
  const canonical = JSON.stringify([ws, e.seq, e.ts, e.kind, e.actor, e.agent_id, e.summary, e.data]);
  return createHash("sha256").update(`${prev}\n${canonical}`).digest("hex");
}

/** Adds one entry at the end of the workspace's chain. Call it inside the caller's transaction when there is one. */
export function appendAudit(
  db: DB,
  ws: string,
  entry: { ts: number; kind: AuditKind; actor: string; agentId?: string | null; summary: string; data?: Record<string, unknown> | null },
): AuditEntry {
  const last = get<{ seq: number; hash: string }>(db, "SELECT seq, hash FROM audit_log WHERE workspace_id = ? ORDER BY seq DESC LIMIT 1", ws);
  const e = {
    seq: (last?.seq ?? 0) + 1,
    ts: entry.ts,
    kind: entry.kind,
    actor: entry.actor,
    agent_id: entry.agentId ?? null,
    summary: entry.summary.slice(0, 1000),
    data: entry.data ? JSON.stringify(entry.data) : null,
  };
  const prev = last?.hash ?? GENESIS;
  const hash = fingerprint(prev, ws, e);
  run(
    db,
    "INSERT INTO audit_log (workspace_id, seq, ts, kind, actor, agent_id, summary, data, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ws, e.seq, e.ts, e.kind, e.actor, e.agent_id, e.summary, e.data, prev, hash,
  );
  return { ...e, prev_hash: prev, hash };
}

export interface AuditCheck {
  ok: boolean;
  entries: number;
  /** The fingerprint of the whole record, as it stands. */
  last_hash: string | null;
  /** The first entry that no longer matches, and why. */
  broken_at?: number;
  problem?: "changed" | "missing" | "reordered";
  checked_at: number;
}

/** Recomputes the whole chain. */
export function verifyAudit(db: DB, ws: string, now = Date.now()): AuditCheck {
  const rows = all<AuditEntry>(db, "SELECT seq, ts, kind, actor, agent_id, summary, data, prev_hash, hash FROM audit_log WHERE workspace_id = ? ORDER BY seq", ws);
  let prev = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.seq !== i + 1) return { ok: false, entries: rows.length, last_hash: rows.at(-1)!.hash, broken_at: i + 1, problem: "missing", checked_at: now };
    if (r.prev_hash !== prev) return { ok: false, entries: rows.length, last_hash: rows.at(-1)!.hash, broken_at: r.seq, problem: "reordered", checked_at: now };
    if (fingerprint(prev, ws, r) !== r.hash) return { ok: false, entries: rows.length, last_hash: rows.at(-1)!.hash, broken_at: r.seq, problem: "changed", checked_at: now };
    prev = r.hash;
  }
  return { ok: true, entries: rows.length, last_hash: rows.length ? prev : null, checked_at: now };
}

export function recentAudit(db: DB, ws: string, limit = 100) {
  return all<AuditEntry>(db, "SELECT seq, ts, kind, actor, agent_id, summary, data, prev_hash, hash FROM audit_log WHERE workspace_id = ? ORDER BY seq DESC LIMIT ?", ws, limit);
}

export function fullAudit(db: DB, ws: string) {
  return all<AuditEntry>(db, "SELECT seq, ts, kind, actor, agent_id, summary, data, prev_hash, hash FROM audit_log WHERE workspace_id = ? ORDER BY seq", ws);
}

/**
 * On the first start with the record, the log lines written before it are added
 * to it, oldest first, so the chain covers the whole history. Does nothing once
 * the record has entries.
 */
export function backfillAudit(db: DB): number {
  if (get(db, "SELECT 1 FROM audit_log LIMIT 1")) return 0;
  const lines = all<{ ts: number; actor: string; agent_id: string | null; message: string; workspace_id: string }>(
    db, "SELECT ts, actor, agent_id, message, COALESCE(workspace_id, ?) AS workspace_id FROM activity ORDER BY ts, id", MAIN_WORKSPACE,
  );
  for (const l of lines) appendAudit(db, l.workspace_id, { ts: l.ts, kind: "activity", actor: l.actor, agentId: l.agent_id, summary: l.message });
  return lines.length;
}
