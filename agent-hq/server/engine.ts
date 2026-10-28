/**
 * The alert engine. It watches each agent's recent events and opens,
 * updates or closes alerts written in plain words. Every detector only
 * looks at events newer than the last time the same kind of alert was
 * resolved, so fixing a problem does not immediately re-open it.
 */
import { all, get, run, type DB } from "./db.ts";
import {
  DAY,
  HOUR,
  MINUTE,
  activePrompt,
  getAgent,
  getRules,
  logActivity,
  monthSpendCents,
  ruleParams,
  type AgentRow,
  type AlertRow,
  type Severity,
} from "./model.ts";
import { lang, locale, many, money, num, timezone, tr } from "./i18n.ts";
import { describeRule } from "./rules.ts";
import { actionLabel, classifyError, languageName, toolLabel, translateError } from "./translate.ts";
import { PRODUCT_NAME } from "./brand.ts";
import { notifyWorkspace } from "./notify.ts";

interface Finding {
  kind: string;
  severity: Severity;
  title: string;
  cause: string;
  impact: string;
  /** When the problem started (first piece of evidence). Defaults to now. */
  since?: number;
}

export const DEFAULT_REPEAT = { count: 10, window_min: 60 };
const ERROR_WINDOW = 30 * MINUTE;
const LANGUAGE_WINDOW = 6 * HOUR;
const ERROR_FAMILY_KINDS = ["auth", "rate_limit", "errors"];

export function upsertAlert(db: DB, agentId: string, f: Finding, now: number): { id: number; created: boolean } {
  const existing = get<AlertRow>(db, "SELECT * FROM alerts WHERE agent_id = ? AND kind = ? AND status = 'open'", agentId, f.kind);
  if (existing) {
    run(db, "UPDATE alerts SET severity = ?, title = ?, cause = ?, impact = ?, updated_at = ? WHERE id = ?", f.severity, f.title, f.cause, f.impact, now, existing.id);
    return { id: existing.id, created: false };
  }
  const res = run(
    db,
    "INSERT INTO alerts (agent_id, kind, severity, title, cause, impact, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    agentId, f.kind, f.severity, f.title, f.cause, f.impact, Math.min(now, f.since ?? now), now,
  );
  logActivity(db, PRODUCT_NAME, tr(`New alert: ${f.title}`, `Nouvelle alerte : ${f.title}`), agentId, now);
  const agent = getAgent(db, agentId);
  if (agent) notifyWorkspace(db, agent.workspace_id, `${f.severity === "warning" ? "🟠" : "🔴"} ${agent.name}: ${f.title}`, { path: "/#/alerts" });
  return { id: Number(res.lastInsertRowid), created: true };
}

export function resolveAlert(db: DB, alertId: number, resolution: string, now: number) {
  run(db, "UPDATE alerts SET status = 'resolved', resolution = ?, resolved_at = ?, updated_at = ? WHERE id = ? AND status = 'open'", resolution, now, now, alertId);
}

function autoResolve(db: DB, agentId: string, kinds: string[], resolution: string, now: number) {
  for (const kind of kinds) {
    const open = get<AlertRow>(db, "SELECT * FROM alerts WHERE agent_id = ? AND kind = ? AND status = 'open'", agentId, kind);
    if (open) {
      resolveAlert(db, open.id, resolution, now);
      logActivity(db, PRODUCT_NAME, tr(`Alert closed automatically: ${open.title}`, `Alerte close automatiquement : ${open.title}`), agentId, now);
    }
  }
}

/** Events older than the last resolution of this kind are already "dealt with". */
function since(db: DB, agentId: string, kinds: string[], windowStart: number): number {
  const placeholders = kinds.map(() => "?").join(",");
  const row = get<{ t: number | null }>(
    db,
    `SELECT MAX(resolved_at) t FROM alerts WHERE agent_id = ? AND kind IN (${placeholders}) AND status = 'resolved'`,
    agentId, ...kinds,
  );
  return Math.max(windowStart, row?.t ?? 0);
}

function recentPromptChange(db: DB, agentId: string, now: number): string | null {
  const p = activePrompt(db, agentId);
  if (!p || p.version <= 1 || now - p.created_at > DAY) return null;
  const at = new Date(p.created_at);
  const day = at.toLocaleDateString(locale(), { weekday: "long", timeZone: timezone() });
  const time = at.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit", timeZone: timezone() });
  return tr(`its instructions were changed on ${day} at ${time} (version ${p.version})`, `ses consignes ont été modifiées ${day} ${time} (version ${p.version})`);
}

function detectDuplicates(db: DB, agent: AgentRow, now: number): Finding | null {
  const rule = getRules(db, agent.workspace_id).find((r) => r.kind === "repeat_pause");
  const { count, window_min } = rule ? ruleParams<typeof DEFAULT_REPEAT>(rule) : DEFAULT_REPEAT;
  const from = since(db, agent.id, ["duplicates"], now - window_min * MINUTE);
  const rows = all<{ action: string; target: string; n: number; first: number }>(
    db,
    `SELECT action, target, COUNT(*) n, MIN(ts) first FROM events
     WHERE agent_id = ? AND kind = 'action' AND target IS NOT NULL AND ts >= ?
     GROUP BY action, target HAVING n > 1`,
    agent.id, from,
  );
  const dupes = rows.reduce((s, r) => s + r.n - 1, 0);
  if (dupes < count) return null;
  const byAction = new Map<string, number>();
  for (const r of rows) byAction.set(r.action, (byAction.get(r.action) ?? 0) + r.n - 1);
  const main = [...byAction.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const change = recentPromptChange(db, agent.id, now);
  const people = /^(e-?mail|gmail|sms)/i.test(main);
  const n = rows.length;
  return {
    kind: "duplicates",
    severity: "critical",
    title: tr(`Repeated ${dupes} actions it had already done (${actionLabel(main)})`, `A fait ${dupes} fois la même action en double (${actionLabel(main)})`),
    cause: change
      ? tr(`${change}, and since then it has been repeating actions already done.`, `${change}, et depuis il répète des actions déjà faites.`)
      : tr(
          "it repeats actions already done for the same recipients, without checking what was already handled.",
          "il répète des actions déjà faites sur les mêmes destinataires, sans vérifier ce qui a déjà été traité.",
        ),
    since: Math.min(...rows.map((r) => r.first)),
    impact: lang() === "fr"
      ? `${n} ${people ? "destinataire" : "élément"}${many(n) ? "s" : ""} concerné${many(n) ? "s" : ""}.`
      : `${n} ${people ? "recipient" : "item"}${many(n) ? "s" : ""} affected.`,
  };
}

function detectErrors(db: DB, agent: AgentRow, now: number): Finding | "healthy" | null {
  const from = since(db, agent.id, ERROR_FAMILY_KINDS, now - ERROR_WINDOW);
  const stats = get<{ n: number; f: number | null }>(db, "SELECT COUNT(*) n, SUM(success = 0) f FROM events WHERE agent_id = ? AND ts >= ?", agent.id, from);
  const n = stats?.n ?? 0;
  const f = stats?.f ?? 0;
  if (n < 5) return null;
  const rate = f / n;
  if (rate < 0.2) return "healthy";
  if (rate < 0.5) return null;
  const top = get<{ error_code: string | null; error_message: string | null; action: string | null; first: number }>(
    db,
    `SELECT error_code, error_message, action, COUNT(*) c, MIN(ts) first FROM events
     WHERE agent_id = ? AND ts >= ? AND success = 0
     GROUP BY error_code, action ORDER BY c DESC LIMIT 1`,
    agent.id, from,
  );
  const family = classifyError(top?.error_code, top?.error_message);
  const t = translateError(family, top?.action ?? null);
  const tool = top?.action ? toolLabel(top.action) : tr("one of its tools", "un de ses outils");
  const pct = Math.round(rate * 100);
  if (family === "auth") {
    return {
      kind: "auth",
      severity: "blocked",
      title: tr(`Can no longer connect to ${tool}`, `N'arrive plus à se connecter à ${tool}`),
      since: top?.first,
      cause: t.cause,
      impact: tr(
        `${f} failed tasks in the last 30 minutes. Nothing moves until access is restored.`,
        `${f} tâches échouées ces 30 dernières minutes. Rien n'avance tant que l'accès n'est pas rétabli.`,
      ),
    };
  }
  if (family === "rate_limit") {
    return {
      kind: "rate_limit",
      severity: "blocked",
      title: tr(`Blocked by ${tool}`, `Bloqué par ${tool}`),
      since: top?.first,
      cause: t.cause,
      impact: tr(`${f} tasks held up in the last 30 minutes.`, `${f} tâches en attente ces 30 dernières minutes.`),
    };
  }
  return {
    kind: "errors",
    severity: "warning",
    title: tr(`${pct}% of its tasks are failing`, `${pct} % de ses tâches échouent`),
    since: top?.first,
    cause: t.cause,
    impact: tr(`${f} of ${n} tasks failed in the last 30 minutes.`, `${f} tâches échouées sur ${n} ces 30 dernières minutes.`),
  };
}

function detectLanguage(db: DB, agent: AgentRow, now: number): Finding | "healthy" | null {
  if (!agent.expected_language) return null;
  const from = since(db, agent.id, ["language"], now - LANGUAGE_WINDOW);
  const rows = all<{ language: string; n: number; first: number }>(
    db,
    "SELECT language, COUNT(*) n, MIN(ts) first FROM events WHERE agent_id = ? AND ts >= ? AND language IS NOT NULL GROUP BY language ORDER BY n DESC",
    agent.id, from,
  );
  const total = rows.reduce((s, r) => s + r.n, 0);
  const expected = agent.expected_language.toLowerCase();
  const wrongRows = rows.filter((r) => r.language.toLowerCase() !== expected);
  const wrong = wrongRows.reduce((s, r) => s + r.n, 0);
  if (total >= 10 && wrong / total < 0.05) return "healthy";
  if (wrong < 5 || wrong / total < 0.3) return null;
  const used = languageName(wrongRows[0].language);
  const change = recentPromptChange(db, agent.id, now);
  return {
    kind: "language",
    severity: "warning",
    title: tr(`Answers in ${used} instead of ${languageName(expected)}`, `Répond en ${used} au lieu du ${languageName(expected)}`),
    since: Math.min(...wrongRows.map((r) => r.first)),
    cause: change
      ? `${change}.`
      : tr(
          "the AI model has probably changed behavior (an update at the provider, or an ambiguous instruction).",
          "le modèle d'IA a probablement changé de comportement (mise à jour chez le fournisseur ou consigne ambiguë).",
        ),
    impact: tr(`${wrong} of ${total} answers in ${used} in the last few hours.`, `${wrong} réponses sur ${total} en ${used} ces dernières heures.`),
  };
}

function detectCost(db: DB, agent: AgentRow, now: number): Finding | "healthy" | null {
  const cur = get<{ c: number | null; n: number }>(db, "SELECT SUM(cost_cents) c, SUM(kind = 'task') n FROM events WHERE agent_id = ? AND ts >= ?", agent.id, now - DAY);
  const prev = get<{ c: number | null; n: number | null }>(db, "SELECT SUM(cost_cents) c, SUM(kind = 'task') n FROM events WHERE agent_id = ? AND ts >= ? AND ts < ?", agent.id, now - 8 * DAY, now - DAY);
  const last24 = cur?.c ?? 0;
  const baseline = (prev?.c ?? 0) / 7;
  if (baseline <= 0) return null;
  const ratio = last24 / baseline;
  if (ratio < 1.3) return "healthy";
  if (ratio < 2 || last24 < 100) return null;
  const perTaskNow = last24 / Math.max(1, cur?.n ?? 0);
  const perTaskBefore = (prev?.c ?? 0) / Math.max(1, prev?.n ?? 0);
  const perTaskRatio = perTaskNow / Math.max(perTaskBefore, 0.0001);
  const x = (r: number) => num(r, 1);
  const spent = money(Math.round(last24));
  const usual = money(Math.round(baseline));
  return {
    kind: "cost",
    severity: "warning",
    title: tr(`Costs ${x(ratio)} times more than usual`, `Coûte ${x(ratio)} fois plus que d'habitude`),
    cause: perTaskRatio >= 1.5
      ? tr(
          `each task costs ${x(perTaskRatio)} times more than before (longer exchanges or a pricier model).`,
          `chaque tâche lui coûte ${x(perTaskRatio)} fois plus cher qu'avant (échanges plus longs ou modèle plus cher).`,
        )
      : tr("it is handling many more tasks than usual.", "il traite beaucoup plus de tâches que d'habitude."),
    impact: tr(`${spent} spent in 24 hours, versus ${usual} on average.`, `${spent} dépensés en 24 h, contre ${usual} en moyenne.`),
  };
}

function detectBudget(db: DB, agent: AgentRow, now: number): Finding | "healthy" | null {
  const spend = monthSpendCents(db, now, { agentId: agent.id });
  const ratio = spend / agent.budget_cents;
  if (ratio < 0.9) return "healthy";
  const d = new Date(now);
  const daysLeft = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
  const pct = Math.round(ratio * 100);
  const days = `${daysLeft} ${tr("day", "jour")}${many(daysLeft) ? "s" : ""}`;
  return {
    kind: "budget",
    severity: ratio >= 1 ? "critical" : "warning",
    title: ratio >= 1
      ? tr("Has used up its monthly budget", "A épuisé son budget du mois")
      : tr(`Has used ${pct}% of its monthly budget`, `A consommé ${pct} % de son budget du mois`),
    cause: ratio >= 1
      ? tr("its new actions are refused until the budget is raised.", "ses nouvelles actions sont refusées jusqu'à ce que le budget soit relevé.")
      : tr(`${days} left before the end of the month.`, `il reste ${days} avant la fin du mois.`),
    impact: tr(`${money(Math.round(spend))} spent of ${money(agent.budget_cents)}.`, `${money(Math.round(spend))} dépensés sur ${money(agent.budget_cents)}.`),
  };
}

const QUALITY_WINDOW = DAY;

function detectQuality(db: DB, agent: AgentRow, now: number): Finding | "healthy" | null {
  const from = since(db, agent.id, ["quality"], now - QUALITY_WINDOW);
  const rows = all<{ verdict: string; human_verdict: string | null; summary: string; created_at: number }>(
    db,
    `SELECT verdict, human_verdict, summary, created_at FROM reviews
     WHERE agent_id = ? AND created_at >= ? AND (human_verdict IS NULL OR human_verdict = 'confirmed')
     ORDER BY created_at DESC`,
    agent.id, from,
  );
  const errors = rows.filter((r) => r.verdict === "error" || r.human_verdict === "confirmed");
  const rate = rows.length ? errors.length / rows.length : 0;
  if (errors.length === 0 || (rows.length >= 5 && rate < 0.05)) return "healthy";
  if (rows.length < 5 || errors.length < 3 || rate < 0.15) return null;
  const pct = Math.round(rate * 100);
  return {
    kind: "quality",
    severity: rate >= 0.3 ? "critical" : "warning",
    title: tr(`${errors.length} of ${rows.length} reviewed answers contain mistakes`, `${errors.length} réponses sur ${rows.length} relues contiennent des erreurs`),
    cause: tr(
      `the AI review found wrong or off-instructions answers. Latest example: “${errors[0].summary}”`,
      `la relecture par IA a trouvé des réponses fausses ou hors consignes. Dernier exemple : « ${errors[0].summary} »`,
    ),
    impact: tr(`about ${pct}% of its reviewed answers need fixing.`, `environ ${pct} % de ses réponses relues sont à corriger.`),
    since: Math.min(...errors.map((e) => e.created_at)),
  };
}

function detectReports(db: DB, agent: AgentRow): Finding | "healthy" {
  const open = all<{ author: string; description: string; created_at: number }>(
    db,
    "SELECT author, description, created_at FROM reports WHERE agent_id = ? AND status = 'open' ORDER BY created_at DESC",
    agent.id,
  );
  if (!open.length) return "healthy";
  const authors = [...new Set(open.map((r) => r.author))];
  return {
    kind: "human_report",
    severity: open.length >= 2 ? "critical" : "warning",
    title: open.length > 1
      ? tr(`${open.length} mistakes reported by your team`, `${open.length} erreurs signalées par votre équipe`)
      : tr(`Mistake reported by ${open[0].author}`, `Erreur signalée par ${open[0].author}`),
    cause: tr(`“${open[0].description}”`, `« ${open[0].description} »`),
    impact: open.length > 1
      ? tr(`reported by ${authors.join(", ")}.`, `signalé par ${authors.join(", ")}.`)
      : tr("to check before it happens again.", "à vérifier avant que cela se reproduise."),
    since: open[open.length - 1].created_at,
  };
}

export function evaluateAgent(db: DB, agentId: string, now = Date.now()): void {
  const agent = getAgent(db, agentId);
  if (!agent) return;

  const reports = detectReports(db, agent);
  if (reports !== "healthy") upsertAlert(db, agent.id, reports, now);

  const dup = detectDuplicates(db, agent, now);
  if (dup) {
    upsertAlert(db, agent.id, dup, now);
    const rule = getRules(db, agent.workspace_id).find((r) => r.kind === "repeat_pause" && r.enabled);
    if (rule && !agent.paused) {
      run(db, "UPDATE agents SET paused = 1, pause_reason = ? WHERE id = ?", tr("Paused automatically: repeated actions", "Mis en pause automatiquement : actions en double"), agent.id);
      run(db, "UPDATE rules SET trigger_count = trigger_count + 1 WHERE id = ?", rule.id);
      run(db, "UPDATE alerts SET resolution = ? WHERE agent_id = ? AND kind = 'duplicates' AND status = 'open'", tr(`${PRODUCT_NAME} paused it automatically.`, `${PRODUCT_NAME} l'a mis en pause automatiquement.`), agent.id);
      const sentence = describeRule(rule.kind, rule.label, ruleParams(rule));
      logActivity(db, PRODUCT_NAME, tr(`${agent.name} paused automatically (rule: ${sentence})`, `${agent.name} mis en pause automatiquement (règle : ${sentence})`), agent.id, now);
    }
  }

  const err = detectErrors(db, agent, now);
  if (err === "healthy") autoResolve(db, agent.id, ERROR_FAMILY_KINDS, tr("Recovered on its own.", "Rétabli tout seul."), now);
  else if (err) {
    upsertAlert(db, agent.id, err, now);
    // Only one error-family alert at a time: the most recent diagnosis wins.
    for (const k of ERROR_FAMILY_KINDS.filter((k) => k !== err.kind)) {
      const other = get<AlertRow>(db, "SELECT * FROM alerts WHERE agent_id = ? AND kind = ? AND status = 'open'", agent.id, k);
      if (other) resolveAlert(db, other.id, tr("Replaced by a more recent diagnosis.", "Remplacée par un diagnostic plus récent."), now);
    }
  }

  for (const [detector, kind] of [[detectLanguage, "language"], [detectCost, "cost"], [detectBudget, "budget"], [detectQuality, "quality"]] as const) {
    const found = detector(db, agent, now);
    if (found === "healthy") autoResolve(db, agent.id, [kind], tr("Back to normal.", "Revenu à la normale."), now);
    else if (found) upsertAlert(db, agent.id, found, now);
  }
}

export function evaluateReports(db: DB, agentId: string, now = Date.now()): void {
  const agent = getAgent(db, agentId);
  if (!agent) return;
  const found = detectReports(db, agent);
  if (found !== "healthy") upsertAlert(db, agent.id, found, now);
}

export function evaluateAll(db: DB, now = Date.now()): void {
  for (const { id } of all<{ id: string }>(db, "SELECT id FROM agents")) evaluateAgent(db, id, now);
}
