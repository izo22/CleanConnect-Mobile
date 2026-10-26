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
    prompts: all<PromptVersionRow>(db, "SELECT * FROM prompt_versions WHERE agent_id = ? ORDER BY version DESC", id),
    alerts: all<AlertRow>(db, "SELECT * FROM alerts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10", id).map((a) => alertView(db, a)),
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
