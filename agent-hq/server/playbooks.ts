/**
 * One-click fixes. Each alert kind offers a short list of actions a
 * manager can take; running one changes the agent, writes the activity
 * log and (usually) closes the alert.
 */
import { get, run, tx, type DB } from "./db.ts";
import { resolveAlert } from "./engine.ts";
import { money, tr } from "./i18n.ts";
import { firstName, getAgent, logActivity, type AgentRow, type AlertRow } from "./model.ts";
import { notify } from "./notify.ts";

export type PlaybookId = "pause" | "resume" | "rollback" | "handoff" | "notify_owner" | "autonomy0" | "economy" | "raise_budget" | "dismiss";

export interface PlaybookAction { id: PlaybookId; label: string }

const PLAYBOOKS: Record<string, PlaybookId[]> = {
  duplicates: ["pause", "rollback", "handoff"],
  auth: ["notify_owner", "pause"],
  rate_limit: ["pause", "notify_owner"],
  errors: ["rollback", "pause", "handoff"],
  language: ["autonomy0", "rollback", "pause"],
  cost: ["economy", "pause"],
  budget: ["raise_budget", "economy", "pause"],
  quality: ["autonomy0", "rollback", "pause", "dismiss"],
  human_report: ["autonomy0", "rollback", "pause", "dismiss"],
};

export class PlaybookError extends Error {}

function previousPrompt(db: DB, agentId: string) {
  return get<{ id: number; version: number }>(
    db,
    `SELECT id, version FROM prompt_versions
     WHERE agent_id = ? AND version < COALESCE((SELECT version FROM prompt_versions WHERE agent_id = ? AND active = 1), 1e9)
     ORDER BY version DESC LIMIT 1`,
    agentId, agentId,
  );
}

export function label(id: PlaybookId, agent: AgentRow): string {
  const owner = firstName(agent.owner_name) || tr("the owner", "le responsable");
  switch (id) {
    case "pause": return agent.paused ? tr("Resume", "Reprendre") : tr("Pause", "Mettre en pause");
    case "resume": return tr("Resume", "Reprendre");
    case "rollback": return tr("Go back to the previous version", "Revenir à la version d'avant");
    case "handoff": return tr(`Hand over to ${owner}`, `Confier à ${owner}`);
    case "notify_owner": return tr(`Alert ${owner}`, `Prévenir ${owner}`);
    case "autonomy0": return tr("Approve everything", "Tout faire valider");
    case "economy": return tr("Switch to the budget model", "Passer au modèle économique");
    case "raise_budget": return `Budget +${money(raiseAmount(agent))}`;
    case "dismiss": return tr("It's fixed", "C'est réglé");
  }
}

const raiseAmount = (agent: AgentRow) => Math.max(1000, Math.ceil((agent.budget_cents * 0.25) / 1000) * 1000);

export function actionsFor(db: DB, alert: AlertRow): PlaybookAction[] {
  const agent = getAgent(db, alert.agent_id);
  if (!agent) return [];
  return (PLAYBOOKS[alert.kind] ?? ["pause", "handoff"])
    .filter((id) => id !== "rollback" || previousPrompt(db, agent.id))
    .filter((id) => id !== "economy" || agent.model_tier !== "economy")
    .filter((id) => id !== "autonomy0" || agent.autonomy !== 0)
    .filter((id) => (id !== "pause" && id !== "handoff") || !agent.paused)
    .map((id) => ({ id, label: label(id, agent) }));
}

/** Applies one action to an agent. Returns the sentence shown to the user. */
export function applyToAgent(db: DB, agent: AgentRow, id: PlaybookId, actor: string, now = Date.now()): string {
  let message: string;
  switch (id) {
    case "pause":
      if (agent.paused) return applyToAgent(db, agent, "resume", actor, now);
      run(db, "UPDATE agents SET paused = 1, pause_reason = ? WHERE id = ?", tr(`paused by ${actor}`, `mis en pause par ${actor}`), agent.id);
      message = tr(`${agent.name} is paused. Its next actions will be refused.`, `${agent.name} est en pause. Ses prochaines actions seront refusées.`);
      break;
    case "resume":
      run(db, "UPDATE agents SET paused = 0, pause_reason = NULL WHERE id = ?", agent.id);
      message = tr(`${agent.name} is back at work.`, `${agent.name} a repris le travail.`);
      break;
    case "rollback": {
      const prev = previousPrompt(db, agent.id);
      if (!prev) throw new PlaybookError(tr("No previous version of the instructions.", "Aucune version précédente des consignes."));
      run(db, "UPDATE prompt_versions SET active = 0 WHERE agent_id = ?", agent.id);
      run(db, "UPDATE prompt_versions SET active = 1 WHERE id = ?", prev.id);
      run(db, "UPDATE agents SET paused = 0, pause_reason = NULL WHERE id = ?", agent.id);
      message = tr(`Instructions from version ${prev.version} restored; ${agent.name} resumes with them.`, `Consignes de la version ${prev.version} restaurées, ${agent.name} reprend avec.`);
      break;
    }
    case "handoff":
      run(db, "UPDATE agents SET paused = 1, pause_reason = ? WHERE id = ?", tr(`tasks handed over to ${agent.owner_name}`, `tâches confiées à ${agent.owner_name}`), agent.id);
      notify(tr(`${actor} is handing you the ongoing tasks of the agent “${agent.name}”.`, `${actor} vous confie les tâches en cours de l'agent « ${agent.name} ».`), agent.owner_email);
      message = tr(`${agent.name}'s tasks handed over to ${agent.owner_name}. The agent is paused.`, `Tâches de ${agent.name} confiées à ${agent.owner_name}. L'agent est en pause.`);
      break;
    case "notify_owner":
      notify(tr(`The agent “${agent.name}” needs you: ${actor} is asking you to step in.`, `L'agent « ${agent.name} » a besoin de vous : ${actor} vous demande d'intervenir.`), agent.owner_email);
      message = tr(`Request sent to ${agent.owner_name}.`, `Demande envoyée à ${agent.owner_name}.`);
      break;
    case "autonomy0":
      run(db, "UPDATE agents SET autonomy = 0 WHERE id = ?", agent.id);
      message = tr(`${agent.name} moves to level 0: every action will be approved by a human.`, `${agent.name} passe au niveau 0 : chaque action sera validée par un humain.`);
      break;
    case "economy":
      run(db, "UPDATE agents SET model_tier = 'economy' WHERE id = ?", agent.id);
      message = tr(`${agent.name} now uses the budget model.`, `${agent.name} utilise désormais le modèle économique.`);
      break;
    case "dismiss":
      message = tr(`Problem marked as fixed for ${agent.name}.`, `Problème marqué comme réglé pour ${agent.name}.`);
      break;
    case "raise_budget": {
      const next = agent.budget_cents + raiseAmount(agent);
      run(db, "UPDATE agents SET budget_cents = ? WHERE id = ?", next, agent.id);
      message = tr(`${agent.name}'s budget raised to ${money(next)} for the month.`, `Budget de ${agent.name} relevé à ${money(next)} pour le mois.`);
      break;
    }
  }
  logActivity(db, actor, message, agent.id, now);
  return message;
}

export function runPlaybook(db: DB, alertId: number, id: PlaybookId, actor: string, now = Date.now()): string {
  return tx(db, () => {
    const alert = get<AlertRow>(db, "SELECT * FROM alerts WHERE id = ?", alertId);
    if (!alert) throw new PlaybookError(tr("Alert not found.", "Alerte introuvable."));
    if (alert.status !== "open") throw new PlaybookError(tr("This alert is already resolved.", "Cette alerte est déjà réglée."));
    if (!actionsFor(db, alert).some((a) => a.id === id)) throw new PlaybookError(tr("Action not available for this alert.", "Action non disponible pour cette alerte."));
    const agent = getAgent(db, alert.agent_id)!;
    const message = applyToAgent(db, agent, id, actor, now);
    if (id === "notify_owner") {
      // The problem is not fixed yet: keep the alert open, note who is on it.
      run(db, "UPDATE alerts SET resolution = ?, updated_at = ? WHERE id = ?", tr(`Waiting for ${agent.owner_name}.`, `En attente de ${agent.owner_name}.`), now, alert.id);
    } else {
      resolveAlert(db, alert.id, message, now);
      // Whatever was done, the reports behind this alert have been dealt with.
      if (alert.kind === "human_report") run(db, "UPDATE reports SET status = 'closed' WHERE agent_id = ? AND status = 'open'", agent.id);
    }
    return message;
  });
}
