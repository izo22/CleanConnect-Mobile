import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
import { all, get, run, type DB } from "./db.ts";

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

export function openAlerts(db: DB, agentId?: string) {
  return agentId
    ? all<AlertRow>(db, "SELECT * FROM alerts WHERE status = 'open' AND agent_id = ? ORDER BY created_at DESC", agentId)
    : all<AlertRow>(db, "SELECT * FROM alerts WHERE status = 'open' ORDER BY created_at DESC");
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

export function monthSpendCents(db: DB, now: number, agentId?: string): number {
  const from = startOfMonth(now);
  const row = agentId
    ? get<{ c: number | null }>(db, "SELECT SUM(cost_cents) c FROM events WHERE agent_id = ? AND ts >= ?", agentId, from)
    : get<{ c: number | null }>(db, "SELECT SUM(cost_cents) c FROM events WHERE ts >= ?", from);
  return row?.c ?? 0;
}

export function logActivity(db: DB, actor: string, message: string, agentId: string | null = null, now = Date.now()) {
  run(db, "INSERT INTO activity (ts, actor, agent_id, message) VALUES (?, ?, ?, ?)", now, actor, agentId, message);
}

export function getRules(db: DB) {
  return all<RuleRow>(db, "SELECT * FROM rules ORDER BY created_at, id");
}

export function ruleParams<T>(rule: RuleRow): T {
  return JSON.parse(rule.params) as T;
}

export function activePrompt(db: DB, agentId: string) {
  return get<PromptVersionRow>(db, "SELECT * FROM prompt_versions WHERE agent_id = ? AND active = 1", agentId);
}

export const firstName = (full: string) => full.split(" ")[0] || full;
