/**
 * REST hooks: automation platforms (Zapier) subscribe to an agent's events
 * and Agent HQ pushes them as they happen.
 *
 * - "decision": a human approved or refused a request this agent made.
 *   A second Zap starts from it and performs the approved action.
 * - "agent_state": the agent was paused or resumed in Agent HQ. A Zap can
 *   switch the matching Zap off (Zapier Manager) — the emergency stop.
 */
import { all, run, type DB } from "./db.ts";
import { callbackBody } from "./callbacks.ts";
import { getAgent, type ApprovalRow } from "./model.ts";

export type HookEvent = "decision" | "agent_state";

export interface HookRow { id: number; agent_id: string; event: HookEvent; target_url: string; filter: string | null; created_at: number }

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/**
 * Agent HQ only calls out to public https addresses, so a leaked agent key
 * cannot make it reach internal services. ALLOW_PRIVATE_HOOKS=true lifts
 * this for local development and tests.
 */
export function safeOutboundUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (process.env.ALLOW_PRIVATE_HOOKS === "true") return u.protocol === "https:" || u.protocol === "http:";
  return u.protocol === "https:" && !PRIVATE_HOST.test(u.hostname);
}

export function subscribe(db: DB, agentId: string, event: HookEvent, targetUrl: string, filter: Record<string, unknown> | null, now = Date.now()): number {
  const res = run(db, "INSERT INTO hooks (agent_id, event, target_url, filter, created_at) VALUES (?, ?, ?, ?, ?)",
    agentId, event, targetUrl, filter ? JSON.stringify(filter) : null, now);
  return Number(res.lastInsertRowid);
}

export function unsubscribe(db: DB, agentId: string, id: number): boolean {
  return run(db, "DELETE FROM hooks WHERE id = ? AND agent_id = ?", id, agentId).changes > 0;
}

const RETRIES = [0, 2_000, 10_000, 30_000];

async function post(db: DB, hook: HookRow, body: unknown, fetchImpl: typeof fetch, delays = RETRIES) {
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetchImpl(hook.target_url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      // 410 Gone: the platform says this subscription no longer exists (Zap deleted).
      if (res.status === 410) { run(db, "DELETE FROM hooks WHERE id = ?", hook.id); return false; }
      if (res.ok) return true;
    } catch {
      // network error: retry
    }
  }
  return false;
}

function matches(hook: HookRow, data: Record<string, unknown>): boolean {
  if (!hook.filter) return true;
  const f = JSON.parse(hook.filter) as Record<string, unknown>;
  return Object.entries(f).every(([k, v]) => v === undefined || v === null || v === "" || data[k] === v);
}

/** The data Zapier receives for a decision. Exported for the "sample" endpoint. */
export const decisionPayload = callbackBody;

export function agentStatePayload(db: DB, agentId: string) {
  const a = getAgent(db, agentId);
  if (!a) return null;
  return {
    id: `${a.id}-${Date.now()}`,
    agent_id: a.id,
    agent_name: a.name,
    paused: !!a.paused,
    state: a.paused ? "paused" : "running",
    reason: a.pause_reason,
    changed_at: new Date().toISOString(),
  };
}

export async function fireDecision(db: DB, approvalId: number, fetchImpl: typeof fetch = fetch, delays?: number[]) {
  const a = all<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", approvalId)[0];
  if (!a || a.status === "pending") return 0;
  const body = decisionPayload(a);
  const hooks = all<HookRow>(db, "SELECT * FROM hooks WHERE agent_id = ? AND event = 'decision'", a.agent_id).filter((h) => matches(h, body));
  const sent = await Promise.all(hooks.map((h) => post(db, h, body, fetchImpl, delays)));
  return sent.filter(Boolean).length;
}

export async function fireAgentState(db: DB, agentId: string, fetchImpl: typeof fetch = fetch, delays?: number[]) {
  const body = agentStatePayload(db, agentId);
  if (!body) return 0;
  const hooks = all<HookRow>(db, "SELECT * FROM hooks WHERE agent_id = ? AND event = 'agent_state'", agentId).filter((h) => matches(h, body));
  const sent = await Promise.all(hooks.map((h) => post(db, h, body, fetchImpl, delays)));
  return sent.filter(Boolean).length;
}
