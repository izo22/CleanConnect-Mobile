/**
 * Chain pause: some agents only make sense together. When an agent upstream
 * stops (by hand, or automatically on repeated actions or failures), the
 * agents it feeds stop too, so they don't keep acting on bad or missing input.
 *
 * Each agent lists the agents downstream of it (`pause_chain`). Pausing walks
 * the chain (cycles are fine) and marks each agent it stops with `paused_by`.
 * Resuming the upstream agent resumes only the agents the chain stopped:
 * an agent someone paused by hand stays paused.
 */
import { all, get, run, type DB } from "./db.ts";
import { tr } from "./i18n.ts";
import { getAgent, logActivity, type AgentRow } from "./model.ts";
import { PRODUCT_NAME } from "./brand.ts";

export function chainIds(agent: Pick<AgentRow, "pause_chain">): string[] {
  try {
    const v = JSON.parse(agent.pause_chain || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Every agent downstream of this one, nearest first, each once, never the agent itself. */
export function downstreamOf(db: DB, agentId: string): AgentRow[] {
  const start = getAgent(db, agentId);
  if (!start) return [];
  const seen = new Set([agentId]);
  const out: AgentRow[] = [];
  const queue = [start];
  while (queue.length) {
    for (const id of chainIds(queue.shift()!)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const a = getAgent(db, id);
      if (!a || a.workspace_id !== start.workspace_id) continue;
      out.push(a);
      queue.push(a);
    }
  }
  return out;
}

/** Pauses the agents downstream of `upstream` that are still running. Returns their ids. */
export function pauseChain(db: DB, upstream: AgentRow, now = Date.now()): string[] {
  const stopped: string[] = [];
  for (const a of downstreamOf(db, upstream.id)) {
    if (a.paused) continue;
    run(db, "UPDATE agents SET paused = 1, pause_reason = ?, paused_by = ? WHERE id = ?",
      tr(`paused with ${upstream.name}`, `mis en pause avec ${upstream.name}`), upstream.id, a.id);
    logActivity(db, PRODUCT_NAME, tr(`${a.name} paused because ${upstream.name} was paused.`, `${a.name} mis en pause parce que ${upstream.name} l'a été.`), a.id, now);
    stopped.push(a.id);
  }
  return stopped;
}

/** Resumes the agents the chain paused because of `upstream` (and, through them, further down). */
export function resumeChain(db: DB, upstream: AgentRow, now = Date.now()): string[] {
  const resumed: string[] = [];
  const queue = [upstream.id];
  while (queue.length) {
    const from = queue.shift()!;
    for (const a of all<AgentRow>(db, "SELECT * FROM agents WHERE paused = 1 AND paused_by = ? AND workspace_id = ?", from, upstream.workspace_id)) {
      run(db, "UPDATE agents SET paused = 0, pause_reason = NULL, paused_by = NULL WHERE id = ?", a.id);
      logActivity(db, PRODUCT_NAME, tr(`${a.name} resumed with ${upstream.name}.`, `${a.name} a repris avec ${upstream.name}.`), a.id, now);
      resumed.push(a.id);
      queue.push(a.id);
    }
  }
  return resumed;
}

/** Paused state of an agent and everything downstream of it, to see what a change touched. */
export function chainStates(db: DB, agentId: string): Map<string, number> {
  const ids = [agentId, ...downstreamOf(db, agentId).map((a) => a.id)];
  return new Map(ids.map((id) => [id, get<{ paused: number }>(db, "SELECT paused FROM agents WHERE id = ?", id)?.paused ?? 0]));
}

/** Checks a chain the owner is saving: agents of the same workspace, not the agent itself. */
export function validChain(db: DB, agent: AgentRow, ids: string[]): string[] {
  const clean = [...new Set(ids)].filter((id) => id !== agent.id);
  for (const id of clean) {
    const a = getAgent(db, id);
    if (!a || a.workspace_id !== agent.workspace_id) {
      throw Object.assign(new Error(tr("Unknown agent in the chain.", "Agent inconnu dans la chaîne.")), { statusCode: 400 });
    }
  }
  return clean;
}
