/**
 * The guard answers the question every agent asks before acting:
 * "may I do this?". Agents call it through the API (or the SDK) and get
 * back allow / deny / needs_approval, with a reason in plain French.
 */
import { run, type DB } from "./db.ts";
import { euros, getRules, logActivity, monthSpendCents, ruleParams, type AgentRow, type RuleRow } from "./model.ts";

export interface CheckRequest {
  action: string;
  amount_cents?: number;
  target?: string;
  /** Short human sentence, e.g. "Rembourser 340 € à Brasserie du Port". */
  summary?: string;
  /** Extra details shown to the human who approves. */
  context?: string;
  /** Agents mark actions that change something important (money, customers). */
  sensitive?: boolean;
  payload?: unknown;
  /**
   * Called with the human decision once it is taken. n8n passes the resume URL
   * of a "Wait" node here, so the workflow sleeps until someone decides.
   */
  callback_url?: string;
}

export type CheckResult =
  | { decision: "allow" }
  | { decision: "deny"; reason: string; rule_id?: string }
  | { decision: "needs_approval"; reason: string; approval_id: number; rule_id?: string };

export interface ApprovalAmountParams { action_prefix: string; max_cents: number }
export interface QuietHoursParams { action_prefix: string; start_hour: number; end_hour: number; timezone: string }
export interface GlobalBudgetParams { max_cents: number }

const matches = (action: string, prefix: string) => prefix === "*" || action.startsWith(prefix);

export function hourIn(timezone: string, now: number): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date(now));
  return Number(h) % 24;
}

export function inQuietHours(p: QuietHoursParams, now: number): boolean {
  const h = hourIn(p.timezone, now);
  return p.start_hour > p.end_hour ? h >= p.start_hour || h < p.end_hour : h >= p.start_hour && h < p.end_hour;
}

function bump(db: DB, rule: RuleRow) {
  run(db, "UPDATE rules SET trigger_count = trigger_count + 1 WHERE id = ?", rule.id);
}

function requestApproval(db: DB, agent: AgentRow, req: CheckRequest, reason: string, now: number): number {
  const title = req.summary?.trim() || `${req.action}${req.amount_cents ? " · " + euros(req.amount_cents) : ""}`;
  const res = run(
    db,
    `INSERT INTO approvals (agent_id, action, title, context, reason, amount_cents, payload, callback_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    agent.id, req.action, title, req.context ?? "", reason, req.amount_cents ?? null,
    req.payload === undefined ? null : JSON.stringify(req.payload), req.callback_url ?? null, now,
  );
  logActivity(db, agent.name, `Demande de validation : ${title}`, agent.id, now);
  return Number(res.lastInsertRowid);
}

export function check(db: DB, agent: AgentRow, req: CheckRequest, now = Date.now()): CheckResult {
  run(db, "UPDATE agents SET last_check_at = ? WHERE id = ?", now, agent.id);
  if (agent.paused) {
    return { decision: "deny", reason: agent.pause_reason ? `Agent en pause (${agent.pause_reason}).` : "Agent en pause." };
  }

  const rules = getRules(db).filter((r) => r.enabled);

  for (const rule of rules.filter((r) => r.kind === "global_budget")) {
    const p = ruleParams<GlobalBudgetParams>(rule);
    if (monthSpendCents(db, now) >= p.max_cents) {
      bump(db, rule);
      return { decision: "deny", reason: `Le budget IA total du mois (${euros(p.max_cents)}) est atteint.`, rule_id: rule.id };
    }
  }

  if (monthSpendCents(db, now, agent.id) >= agent.budget_cents) {
    return { decision: "deny", reason: `Le budget de cet agent pour le mois (${euros(agent.budget_cents)}) est épuisé.` };
  }

  for (const rule of rules.filter((r) => r.kind === "quiet_hours")) {
    const p = ruleParams<QuietHoursParams>(rule);
    if (matches(req.action, p.action_prefix) && inQuietHours(p, now)) {
      bump(db, rule);
      return { decision: "deny", reason: `Pas d'envoi entre ${p.start_hour} h et ${p.end_hour} h. Réessayez plus tard.`, rule_id: rule.id };
    }
  }

  if (agent.autonomy === 0) {
    const id = requestApproval(db, agent, req, "cet agent est au niveau 0 (en formation) : chaque action est validée.", now);
    return { decision: "needs_approval", reason: "Niveau 0 : validation humaine requise.", approval_id: id };
  }

  for (const rule of rules.filter((r) => r.kind === "approval_amount")) {
    const p = ruleParams<ApprovalAmountParams>(rule);
    if (req.amount_cents !== undefined && matches(req.action, p.action_prefix) && req.amount_cents > p.max_cents) {
      bump(db, rule);
      const id = requestApproval(db, agent, req, `le montant dépasse votre seuil de ${euros(p.max_cents)}.`, now);
      return { decision: "needs_approval", reason: `Au-dessus de ${euros(p.max_cents)} : validation requise.`, approval_id: id, rule_id: rule.id };
    }
  }

  if (agent.autonomy === 1 && req.sensitive) {
    const id = requestApproval(db, agent, req, "cet agent est au niveau 1 : les actions sensibles sont validées.", now);
    return { decision: "needs_approval", reason: "Action sensible : validation requise au niveau 1.", approval_id: id };
  }

  return { decision: "allow" };
}
