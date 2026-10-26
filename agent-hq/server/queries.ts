/** Read models for the dashboard: everything the UI shows, ready to render. */
import { all, get, type DB } from "./db.ts";
import {
  DAY,
  HOUR,
  getAgent,
  getRules,
  monthSpendCents,
  openAlerts,
  ruleParams,
  startOfMonth,
  statusOf,
  type AgentRow,
  type AgentStatus,
  type AlertRow,
  type ApprovalRow,
  type PromptVersionRow,
} from "./model.ts";
import { actionsFor } from "./playbooks.ts";
import type { GlobalBudgetParams } from "./guard.ts";
import { describeRule } from "./rules.ts";
import { REVIEW_MODEL, pendingCount, reviewerEnabled } from "./reviewer.ts";
import { controlLevel } from "./n8n.ts";

const SEVERITY_ORDER = { critical: 0, blocked: 1, warning: 2 } as const;
const STATUS_ORDER: Record<AgentStatus, number> = { blocked: 0, attention: 1, paused: 2, ok: 3 };

interface Stats { agent_id: string; n: number; ok: number; tasks: number; cost: number }

function statsByAgent(db: DB, from: number) {
  const rows = all<Stats>(
    db,
    `SELECT agent_id, COUNT(*) n, SUM(success) ok, SUM(kind = 'task' AND success = 1) tasks, SUM(cost_cents) cost
     FROM events WHERE ts >= ? GROUP BY agent_id`,
    from,
  );
  return new Map(rows.map((r) => [r.agent_id, r]));
}

function sparklines(db: DB, now: number) {
  const start = now - DAY;
  const rows = all<{ agent_id: string; b: number; c: number }>(
    db,
    `SELECT agent_id, CAST((ts - ?) / ? AS INTEGER) b, COUNT(*) c FROM events
     WHERE ts >= ? AND kind = 'task' GROUP BY agent_id, b`,
    start, HOUR, start,
  );
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const arr = map.get(r.agent_id) ?? new Array(24).fill(0);
    if (r.b >= 0 && r.b < 24) arr[r.b] = r.c;
    map.set(r.agent_id, arr);
  }
  return map;
}

function monthSpendByAgent(db: DB, now: number) {
  const rows = all<{ agent_id: string; c: number }>(db, "SELECT agent_id, SUM(cost_cents) c FROM events WHERE ts >= ? GROUP BY agent_id", startOfMonth(now));
  return new Map(rows.map((r) => [r.agent_id, r.c]));
}

export function agentSummaries(db: DB, now = Date.now()) {
  const agents = all<AgentRow>(db, "SELECT * FROM agents");
  const alerts = openAlerts(db);
  const stats = statsByAgent(db, now - DAY);
  const sparks = sparklines(db, now);
  const spend = monthSpendByAgent(db, now);
  return agents
    .map((a) => {
      const s = stats.get(a.id);
      return {
        id: a.id,
        name: a.name,
        mission: a.mission,
        owner_name: a.owner_name,
        platform: a.platform,
        source: a.source,
        control: controlLevel(a, now),
        status: statusOf(a, alerts),
        autonomy: a.autonomy,
        paused: !!a.paused,
        pause_reason: a.pause_reason,
        model_tier: a.model_tier,
        open_alerts: alerts.filter((x) => x.agent_id === a.id).length,
        tasks_24h: s?.tasks ?? 0,
        success_rate: s && s.n ? s.ok / s.n : null,
        cost_per_task_cents: s && s.tasks ? s.cost / s.tasks : null,
        minutes_saved_24h: (s?.tasks ?? 0) * a.minutes_per_task,
        spent_month_cents: Math.round(spend.get(a.id) ?? 0),
        budget_cents: a.budget_cents,
        sparkline: sparks.get(a.id) ?? new Array(24).fill(0),
      };
    })
    .sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || y.tasks_24h - x.tasks_24h);
}

export type AgentSummary = ReturnType<typeof agentSummaries>[number];

export function alertView(db: DB, alert: AlertRow) {
  const agent = getAgent(db, alert.agent_id);
  return {
    ...alert,
    agent: agent ? { id: agent.id, name: agent.name, owner_name: agent.owner_name } : null,
    actions: alert.status === "open" ? actionsFor(db, alert) : [],
  };
}

export function alertsView(db: DB) {
  const open = openAlerts(db).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.created_at - a.created_at);
  const resolved = all<AlertRow>(db, "SELECT * FROM alerts WHERE status = 'resolved' ORDER BY resolved_at DESC LIMIT 30");
  return { open: open.map((a) => alertView(db, a)), resolved: resolved.map((a) => alertView(db, a)) };
}

function approvalView(db: DB, a: ApprovalRow) {
  const agent = getAgent(db, a.agent_id);
  return { ...a, payload: a.payload ? JSON.parse(a.payload) : null, agent: agent ? { id: agent.id, name: agent.name } : null };
}

export function approvalsView(db: DB) {
  const pending = all<ApprovalRow>(db, "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at");
  const decided = all<ApprovalRow>(db, "SELECT * FROM approvals WHERE status != 'pending' ORDER BY decided_at DESC LIMIT 30");
  return { pending: pending.map((a) => approvalView(db, a)), decided: decided.map((a) => approvalView(db, a)) };
}

export function globalBudgetCents(db: DB): number | null {
  const rule = getRules(db).find((r) => r.kind === "global_budget" && r.enabled);
  return rule ? ruleParams<GlobalBudgetParams>(rule).max_cents : null;
}

export function overview(db: DB, now = Date.now()) {
  const agents = agentSummaries(db, now);
  const count = (s: AgentStatus) => agents.filter((a) => a.status === s).length;
  const cost24 = get<{ c: number | null }>(db, "SELECT SUM(cost_cents) c FROM events WHERE ts >= ?", now - DAY)?.c ?? 0;
  const costPrev = get<{ c: number | null }>(db, "SELECT SUM(cost_cents) c FROM events WHERE ts >= ? AND ts < ?", now - 8 * DAY, now - DAY)?.c ?? 0;
  const spent = monthSpendCents(db, now);
  const d = new Date(now);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const elapsedDays = Math.max(1, (now - startOfMonth(now)) / DAY);
  const alerts = alertsView(db).open;
  const approvals = approvalsView(db).pending;
  return {
    now,
    counts: { total: agents.length, ok: count("ok"), attention: count("attention"), blocked: count("blocked"), paused: count("paused") },
    tasks_24h: agents.reduce((s, a) => s + a.tasks_24h, 0),
    minutes_saved_24h: Math.round(agents.reduce((s, a) => s + a.minutes_saved_24h, 0)),
    cost_24h_cents: Math.round(cost24),
    cost_avg_day_cents: Math.round(costPrev / 7),
    month: {
      spent_cents: Math.round(spent),
      budget_cents: globalBudgetCents(db),
      projection_cents: Math.round((spent / elapsedDays) * daysInMonth),
    },
    alerts,
    approvals,
    quality_flagged: get<{ n: number }>(db, "SELECT COUNT(*) n FROM reviews WHERE verdict != 'ok' AND human_verdict IS NULL")?.n ?? 0,
  };
}

export function agentDetail(db: DB, id: string, now = Date.now()) {
  const agent = getAgent(db, id);
  if (!agent) return null;
  const summary = agentSummaries(db, now).find((a) => a.id === id)!;
  return {
    ...summary,
    owner_email: agent.owner_email,
    expected_language: agent.expected_language,
    access: JSON.parse(agent.access) as string[],
    minutes_per_task: agent.minutes_per_task,
    api_key: agent.api_key,
    integration_id: agent.integration_id,
    external_id: agent.external_id,
    last_check_at: agent.last_check_at,
    prompts: all<PromptVersionRow>(db, "SELECT * FROM prompt_versions WHERE agent_id = ? ORDER BY version DESC", id),
    alerts: all<AlertRow>(db, "SELECT * FROM alerts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10", id).map((a) => alertView(db, a)),
    review_rate: agent.review_rate,
    quality: agentQuality(db, id, now),
    activity: activity(db, 15, id),
  };
}

export function rulesView(db: DB) {
  return getRules(db).map((r) => {
    const params = JSON.parse(r.params);
    return { ...r, enabled: !!r.enabled, params, sentence: describeRule(r.kind, r.label, params) };
  });
}

export function activity(db: DB, limit = 50, agentId?: string) {
  return agentId
    ? all<{ id: number; ts: number; actor: string; agent_id: string | null; message: string }>(db, "SELECT * FROM activity WHERE agent_id = ? ORDER BY ts DESC, id DESC LIMIT ?", agentId, limit)
    : all<{ id: number; ts: number; actor: string; agent_id: string | null; message: string }>(db, "SELECT * FROM activity ORDER BY ts DESC, id DESC LIMIT ?", limit);
}

export type Overview = ReturnType<typeof overview>;
export type AlertView = ReturnType<typeof alertView>;
export type AlertsView = ReturnType<typeof alertsView>;
export type ApprovalsView = ReturnType<typeof approvalsView>;
export type ApprovalView = ApprovalsView["pending"][number];
export type AgentDetail = NonNullable<ReturnType<typeof agentDetail>>;
export type RuleView = ReturnType<typeof rulesView>[number];
export type ActivityRow = ReturnType<typeof activity>[number];

interface ReviewedExchange {
  review_id: number;
  event_id: number;
  agent_id: string;
  agent_name: string;
  ts: number;
  action: string | null;
  input: string | null;
  output: string | null;
  verdict: "ok" | "doubt" | "error";
  score: number;
  summary: string;
  issues: string;
  reviewer: string;
  human_verdict: "confirmed" | "dismissed" | null;
}

const EXCHANGE_SQL = `
  SELECT r.id review_id, e.id event_id, e.agent_id, a.name agent_name, e.ts, e.action, e.input, e.output,
         r.verdict, r.score, r.summary, r.issues, r.reviewer, r.human_verdict
  FROM reviews r JOIN events e ON e.id = r.event_id JOIN agents a ON a.id = r.agent_id`;

const exchangeView = (x: ReviewedExchange) => ({ ...x, issues: JSON.parse(x.issues) as Array<{ type: string; detail: string }> });

function qualityStats(db: DB, from: number, agentId?: string) {
  const row = get<{ n: number; errors: number | null; doubts: number | null }>(
    db,
    `SELECT COUNT(*) n,
            SUM(verdict = 'error' AND COALESCE(human_verdict, '') != 'dismissed' OR human_verdict = 'confirmed') errors,
            SUM(verdict = 'doubt' AND human_verdict IS NULL) doubts
     FROM reviews WHERE created_at >= ?${agentId ? " AND agent_id = ?" : ""}`,
    ...(agentId ? [from, agentId] : [from]),
  );
  const n = row?.n ?? 0;
  const errors = row?.errors ?? 0;
  return { reviewed: n, errors, doubts: row?.doubts ?? 0, quality: n ? 1 - errors / n : null };
}

export function qualityView(db: DB, now = Date.now()) {
  const flagged = all<ReviewedExchange>(
    db,
    `${EXCHANGE_SQL} WHERE r.verdict != 'ok' AND r.human_verdict IS NULL ORDER BY e.ts DESC LIMIT 50`,
  ).map(exchangeView);
  const reports = all<{ id: number; agent_id: string; agent_name: string; author: string; description: string; status: string; created_at: number }>(
    db,
    "SELECT p.*, a.name agent_name FROM reports p JOIN agents a ON a.id = p.agent_id ORDER BY p.created_at DESC LIMIT 30",
  );
  return {
    reviewer: { enabled: reviewerEnabled(), model: REVIEW_MODEL, pending: pendingCount(db) },
    stats: qualityStats(db, now - 7 * DAY),
    flagged,
    reports,
  };
}

export function agentQuality(db: DB, agentId: string, now = Date.now()) {
  const recent = all<ReviewedExchange>(db, `${EXCHANGE_SQL} WHERE r.agent_id = ? ORDER BY e.ts DESC LIMIT 6`, agentId).map(exchangeView);
  const unreviewed = all<{ id: number; ts: number; action: string | null; input: string | null; output: string | null }>(
    db,
    "SELECT id, ts, action, input, output FROM events WHERE agent_id = ? AND output IS NOT NULL ORDER BY ts DESC LIMIT 5",
    agentId,
  );
  return { stats: qualityStats(db, now - 7 * DAY, agentId), recent, latest: unreviewed };
}

export type QualityView = ReturnType<typeof qualityView>;
export type ExchangeView = ReturnType<typeof exchangeView>;
