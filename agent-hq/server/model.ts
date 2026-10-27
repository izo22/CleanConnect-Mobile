import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
import { MAIN_WORKSPACE, all, get, run, type DB } from "./db.ts";

export type Autonomy = 0 | 1 | 2;
export type Severity = "critical" | "warning" | "blocked";
export type AgentStatus = "ok" | "attention" | "blocked" | "paused";

export interface AgentRow {
  id: string;
  name: string;
  mission: string;
  owner_name: string;
  owner_email: string;
  platform: string;
  autonomy: Autonomy;
  paused: number;
  pause_reason: string | null;
  budget_cents: number;
  model_tier: string;
  expected_language: string | null;
  access: string;
  minutes_per_task: number;
  api_key: string;
  review_rate: number;
  source: "sdk" | "n8n";
  integration_id: number | null;
  external_id: string | null;
  last_check_at: number | null;
  workspace_id: string;
  created_at: number;
}

export interface AlertRow {
  id: number;
  agent_id: string;
  kind: string;
  severity: Severity;
  title: string;
  cause: string;
  impact: string;
  status: "open" | "resolved";
  resolution: string | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
}

export interface ApprovalRow {
  id: number;
  agent_id: string;
  action: string;
  title: string;
  context: string;
  reason: string;
  amount_cents: number | null;
  payload: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: number;
  decided_at: number | null;
  decided_by: string | null;
  callback_url: string | null;
  callback_status: string | null;
}

export interface RuleRow {
  id: string;
  workspace_id: string;
  kind: RuleKind;
  label: string;
  params: string;
  enabled: number;
  trigger_count: number;
  created_at: number;
}

export type RuleKind = "approval_amount" | "quiet_hours" | "global_budget" | "repeat_pause";

export type Verdict = "ok" | "doubt" | "error";

export interface ReviewRow {
  id: number;
  event_id: number;
  agent_id: string;
  verdict: Verdict;
  score: number;
  summary: string;
  issues: string;
  reviewer: string;
  human_verdict: "confirmed" | "dismissed" | null;
  created_at: number;
}

export interface ReportRow {
  id: number;
  agent_id: string;
  event_id: number | null;
  author: string;
  description: string;
  status: "open" | "closed";
  created_at: number;
}

export interface PromptVersionRow {
  id: number;
  agent_id: string;
  version: number;
  content: string;
  note: string | null;
  active: number;
  created_at: number;
}

/** Fired after anything changes, so connected dashboards refresh. */
export const bus = new EventEmitter();
bus.setMaxListeners(1000);
export const notifyChange = () => bus.emit("change");

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const newApiKey = () => "ahq_" + randomBytes(18).toString("base64url");

export function getAgent(db: DB, id: string) {
  return get<AgentRow>(db, "SELECT * FROM agents WHERE id = ?", id);
}

export function getAgentByKey(db: DB, key: string) {
  return get<AgentRow>(db, "SELECT * FROM agents WHERE api_key = ?", key);
}

/** Open alerts of one workspace. */
export function openAlerts(db: DB, workspaceId: string) {
  return all<AlertRow>(
    db,
    `SELECT l.* FROM alerts l JOIN agents a ON a.id = l.agent_id
     WHERE l.status = 'open' AND a.workspace_id = ? ORDER BY l.created_at DESC`,
    workspaceId,
  );
}

export function statusOf(agent: AgentRow, alerts: AlertRow[]): AgentStatus {
  if (agent.paused) return "paused";
  const mine = alerts.filter((a) => a.agent_id === agent.id);
  if (mine.some((a) => a.severity === "blocked")) return "blocked";
  if (mine.length) return "attention";
  return "ok";
}

export function startOfMonth(now: number) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** What one agent, or a whole workspace, has spent since the start of the month. */
export function monthSpendCents(db: DB, now: number, scope: { agentId: string } | { workspaceId: string }): number {
  const from = startOfMonth(now);
  const row = "agentId" in scope
    ? get<{ c: number | null }>(db, "SELECT SUM(cost_cents) c FROM events WHERE agent_id = ? AND ts >= ?", scope.agentId, from)
    : get<{ c: number | null }>(
        db,
        "SELECT SUM(e.cost_cents) c FROM events e JOIN agents a ON a.id = e.agent_id WHERE a.workspace_id = ? AND e.ts >= ?",
        scope.workspaceId, from,
      );
  return row?.c ?? 0;
}

/**
 * Writes one line of the journal. It belongs to the agent's workspace, or to
 * `workspaceId` for actions that concern no agent (rules, connections).
 */
export function logActivity(db: DB, actor: string, message: string, agentId: string | null = null, now = Date.now(), workspaceId?: string) {
  run(
    db,
    `INSERT INTO activity (ts, actor, agent_id, message, workspace_id)
     VALUES (?, ?, ?, ?, COALESCE(?, (SELECT workspace_id FROM agents WHERE id = ?), ?))`,
    now, actor, agentId, message, workspaceId ?? null, agentId, MAIN_WORKSPACE,
  );
}

export function getRules(db: DB, workspaceId: string) {
  return all<RuleRow>(db, "SELECT * FROM rules WHERE workspace_id = ? ORDER BY created_at, id", workspaceId);
}

export function ruleParams<T>(rule: RuleRow): T {
  return JSON.parse(rule.params) as T;
}

export function activePrompt(db: DB, agentId: string) {
  return get<PromptVersionRow>(db, "SELECT * FROM prompt_versions WHERE agent_id = ? AND active = 1", agentId);
}

export const firstName = (full: string) => full.split(" ")[0] || full;
