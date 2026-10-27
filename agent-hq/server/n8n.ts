/**
 * n8n integration. Three levels, from the least to the most intrusive:
 *
 * 1. Supervision — with an n8n API key, Orvanta lists the workflows (one
 *    agent each) and imports every finished execution as an event, error
 *    message included. Nothing changes in the workflows.
 * 2. Emergency stop — pausing the agent deactivates the workflow in n8n;
 *    resuming reactivates it. An execution already running finishes.
 * 3. Control before acting — the workflow calls /api/v1/check before a
 *    sensitive step and waits (n8n "Wait" node) for the human decision.
 */
import { all, get, run, tx, type DB } from "./db.ts";
import { evaluateAgent } from "./engine.ts";
import { DAY, HOUR, logActivity, newApiKey, notifyChange, type AgentRow } from "./model.ts";
import { tr } from "./i18n.ts";
import { PRODUCT_NAME } from "./brand.ts";

export interface N8nWorkflow { id: string; name: string; active: boolean; isArchived?: boolean; nodes?: Array<{ type: string; name: string }> }

export interface N8nExecution {
  id: string | number;
  workflowId: string;
  status?: string;
  finished?: boolean;
  startedAt?: string | null;
  stoppedAt?: string | null;
  data?: {
    resultData?: {
      error?: { message?: string; description?: string; httpCode?: string | number; name?: string; node?: { name?: string; type?: string } };
      lastNodeExecuted?: string;
    };
  };
}

export interface IntegrationRow {
  id: number;
  kind: "n8n";
  name: string;
  base_url: string;
  api_key: string;
  cursor_execution_id: number;
  last_sync_at: number | null;
  last_error: string | null;
  created_at: number;
}

export class N8nError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

type Fetch = typeof fetch;

export class N8nClient {
  private base: string;
  constructor(baseUrl: string, private apiKey: string, private fetchImpl: Fetch = fetch) {
    this.base = baseUrl.replace(/\/+$/, "");
  }

  private async call<T>(path: string, method = "GET"): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/api/v1${path}`, {
        method,
        headers: { "X-N8N-API-KEY": this.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new N8nError(tr(`n8n is not responding at ${this.base} (${(err as Error).message}).`, `n8n ne répond pas à l'adresse ${this.base} (${(err as Error).message}).`));
    }
    const body = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (res.status === 401 || res.status === 403) throw new N8nError(tr("n8n refuses the API key (invalid or expired key).", "n8n refuse la clé API (clé invalide ou expirée)."), res.status);
    if (!res.ok) throw new N8nError(tr(`n8n answered ${res.status}${body.message ? ": " + body.message : ""}.`, `n8n a répondu ${res.status}${body.message ? " : " + body.message : ""}.`), res.status);
    return body;
  }

  async listWorkflows(): Promise<N8nWorkflow[]> {
    const out: N8nWorkflow[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.call<{ data: N8nWorkflow[]; nextCursor?: string | null }>(`/workflows?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      out.push(...page.data.filter((w) => !w.isArchived)); // archived = in n8n's bin
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  }

  /** Newest first, down to (and excluding) `afterId`. */
  async listExecutionsSince(afterId: number, max = 1000): Promise<N8nExecution[]> {
    const out: N8nExecution[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.call<{ data: N8nExecution[]; nextCursor?: string | null }>(`/executions?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      for (const e of page.data) {
        if (Number(e.id) <= afterId) return out;
        out.push(e);
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor && out.length < max);
    return out;
  }

  getExecution(id: string | number) {
    return this.call<N8nExecution>(`/executions/${id}?includeData=true`);
  }

  activate(workflowId: string) {
    return this.call<N8nWorkflow>(`/workflows/${workflowId}/activate`, "POST");
  }

  deactivate(workflowId: string) {
    return this.call<N8nWorkflow>(`/workflows/${workflowId}/deactivate`, "POST");
  }
}

export const clientFor = (i: IntegrationRow, fetchImpl?: Fetch) => new N8nClient(i.base_url, i.api_key, fetchImpl);

export function getIntegration(db: DB, id: number) {
  return get<IntegrationRow>(db, "SELECT * FROM integrations WHERE id = ?", id);
}

/** Pause reasons written when someone switched the workflow off (or deleted it) inside n8n. */
const OFF_IN_N8N = ["switched off in n8n", "désactivé dans n8n"] as const;
const DELETED_IN_N8N = ["deleted in n8n", "supprimé dans n8n"] as const;

// Nodes that say nothing about the tool behind them: use the node's name instead.
const GENERIC_NODES = new Set(["httprequest", "code", "function", "functionitem", "executeworkflow", "set", "if", "switch"]);

/**
 * "n8n-nodes-base.hubspot" → "hubspot.run"; a generic HTTP node named
 * "HubSpot · update" → "HubSpot · update.run", so alerts name the tool.
 */
function actionOf(node: { type?: string; name?: string } | undefined): string | null {
  if (!node?.type) return null;
  const short = (node.type.split(".").pop() ?? node.type).replace(/Tool$|Trigger$/, "").toLowerCase();
  if (GENERIC_NODES.has(short) && node.name) return `${node.name.replace(/[.:/]/g, " ").trim()}.run`;
  return `${short}.run`;
}

const ts = (s: string | null | undefined, fallback: number) => (s ? Date.parse(s) || fallback : fallback);

export interface SyncResult { workflows: number; created: number; imported: number }

/**
 * Brings one n8n instance up to date: workflows become agents, finished
 * executions become events, and pauses decided in Orvanta are enforced.
 */
export async function syncIntegration(db: DB, integration: IntegrationRow, client = clientFor(integration), now = Date.now()): Promise<SyncResult> {
  try {
    const workflows = await client.listWorkflows();
    let created = 0;
    const toEnforce: Array<{ agent: AgentRow; wf: N8nWorkflow }> = [];

    tx(db, () => {
      // Workflows deleted in n8n: keep the agent and its history, show why it stopped.
      const present = new Set(workflows.map((w) => w.id));
      for (const gone of all<AgentRow>(db, "SELECT * FROM agents WHERE integration_id = ? AND COALESCE(pause_reason, '') NOT IN (?, ?)", integration.id, ...DELETED_IN_N8N)) {
        if (gone.external_id && !present.has(gone.external_id)) {
          run(db, "UPDATE agents SET paused = 1, pause_reason = ? WHERE id = ?", tr(...DELETED_IN_N8N), gone.id);
          logActivity(db, "n8n", tr(`${gone.name} was deleted in n8n.`, `${gone.name} a été supprimé dans n8n.`), gone.id, now);
        }
      }
      for (const wf of workflows) {
        const existing = get<AgentRow>(db, "SELECT * FROM agents WHERE integration_id = ? AND external_id = ?", integration.id, wf.id);
        if (!existing) {
          const id = `n8n-${integration.id}-${wf.id}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
          run(
            db,
            `INSERT INTO agents (id, name, mission, owner_name, owner_email, platform, autonomy, paused, pause_reason, budget_cents, access, api_key, source, integration_id, external_id, created_at)
             VALUES (?, ?, ?, '', '', 'n8n', 2, ?, ?, 10000, '[]', ?, 'n8n', ?, ?, ?)`,
            id, wf.name, tr(`n8n workflow “${wf.name}”`, `Workflow n8n « ${wf.name} »`), wf.active ? 0 : 1, wf.active ? null : tr(...OFF_IN_N8N), newApiKey(), integration.id, wf.id, now,
          );
          logActivity(db, PRODUCT_NAME, tr(`n8n workflow imported: ${wf.name}`, `Workflow n8n importé : ${wf.name}`), id, now);
          created++;
          continue;
        }
        if (existing.name !== wf.name) run(db, "UPDATE agents SET name = ? WHERE id = ?", wf.name, existing.id);
        if (!existing.paused && !wf.active) {
          // Switched off in n8n by someone: respect it and show it.
          run(db, "UPDATE agents SET paused = 1, pause_reason = ? WHERE id = ?", tr(...OFF_IN_N8N), existing.id);
          logActivity(db, "n8n", tr(`${existing.name} was switched off in n8n.`, `${existing.name} a été désactivé dans n8n.`), existing.id, now);
        } else if (existing.paused && (OFF_IN_N8N as readonly string[]).includes(existing.pause_reason ?? "") && wf.active) {
          run(db, "UPDATE agents SET paused = 0, pause_reason = NULL WHERE id = ?", existing.id);
          logActivity(db, "n8n", tr(`${existing.name} was switched back on in n8n.`, `${existing.name} a été réactivé dans n8n.`), existing.id, now);
        } else if (existing.paused && wf.active) {
          // Paused by Orvanta (a person or a guardrail) but running in n8n: enforce.
          toEnforce.push({ agent: existing, wf });
        }
      }
    });

    for (const { agent } of toEnforce) {
      await client.deactivate(agent.external_id!);
      logActivity(db, PRODUCT_NAME, tr(`${agent.name} switched off in n8n (paused in ${PRODUCT_NAME}).`, `${agent.name} désactivé dans n8n (pause décidée dans ${PRODUCT_NAME}).`), agent.id, now);
    }

    // Executions: newest first back to the cursor. Unfinished ones are kept
    // below the next cursor so they are imported once they finish.
    const executions = await client.listExecutionsSince(integration.cursor_execution_id);
    const byWorkflow = new Map(
      all<{ id: string; external_id: string }>(db, "SELECT id, external_id FROM agents WHERE integration_id = ?", integration.id).map((a) => [a.external_id, a.id]),
    );
    const finished = executions.filter((e) => ["success", "error", "crashed"].includes(e.status ?? (e.finished ? "success" : "running")));
    // Executions still running or waiting (e.g. for a human decision) hold the
    // cursor back, unless they are older than 2 days: then they are given up on.
    const unfinished = executions.filter((e) => !finished.includes(e) && e.status !== "canceled" && ts(e.startedAt, now) > now - 2 * DAY);
    const details = new Map<string, N8nExecution>();
    for (const e of finished.filter((e) => e.status !== "success").slice(0, 50)) {
      details.set(String(e.id), await client.getExecution(e.id).catch(() => e));
    }

    let imported = 0;
    const touched = new Set<string>();
    tx(db, () => {
      const insert = db.prepare(
        `INSERT OR IGNORE INTO events (agent_id, ts, kind, action, target, success, cost_cents, duration_ms, error_code, error_message, external_ref)
         VALUES (?, ?, 'task', ?, ?, ?, 0, ?, ?, ?, ?)`,
      );
      for (const e of finished) {
        const agentId = byWorkflow.get(String(e.workflowId));
        if (!agentId) continue;
        const ok = e.status === "success";
        const full = details.get(String(e.id)) ?? e;
        const err = full.data?.resultData?.error;
        const start = ts(e.startedAt, now);
        const end = ts(e.stoppedAt, start);
        const res = insert.run(
          agentId, end, actionOf(err?.node) ?? "workflow.run", `execution-${e.id}`, ok ? 1 : 0, Math.max(0, end - start),
          ok ? null : String(err?.httpCode ?? err?.name ?? e.status ?? "error"),
          ok ? null : [err?.message, err?.description].filter(Boolean).join(" — ").slice(0, 2000) || tr("n8n execution failed", "Échec de l'exécution n8n"),
          `n8n:${e.id}`,
        );
        if (res.changes) { imported++; touched.add(agentId); }
      }
      const ids = executions.map((e) => Number(e.id)).filter(Number.isFinite);
      const lowestOpen = unfinished.length ? Math.min(...unfinished.map((e) => Number(e.id))) - 1 : Infinity;
      const next = Math.min(ids.length ? Math.max(...ids) : integration.cursor_execution_id, lowestOpen);
      run(db, "UPDATE integrations SET cursor_execution_id = ?, last_sync_at = ?, last_error = NULL WHERE id = ?",
        Math.max(integration.cursor_execution_id, next), now, integration.id);
      for (const id of touched) evaluateAgent(db, id, now);
    });
    notifyChange();
    return { workflows: workflows.length, created, imported };
  } catch (err) {
    run(db, "UPDATE integrations SET last_error = ?, last_sync_at = ? WHERE id = ?", (err as Error).message, now, integration.id);
    notifyChange();
    throw err;
  }
}

/**
 * Applies a pause or a resume to the real workflow before Orvanta records
 * it, so the screen never says "paused" while n8n keeps running.
 */
export async function setWorkflowActive(db: DB, agent: AgentRow, active: boolean, fetchImpl?: Fetch) {
  if (agent.source !== "n8n" || !agent.integration_id || !agent.external_id) return;
  const integration = getIntegration(db, agent.integration_id);
  if (!integration) throw new N8nError(tr("This agent's n8n connection was deleted.", "La connexion n8n de cet agent a été supprimée."));
  const client = clientFor(integration, fetchImpl);
  if (active) await client.activate(agent.external_id);
  else await client.deactivate(agent.external_id);
}

export async function syncAll(db: DB, fetchImpl?: Fetch) {
  for (const i of all<IntegrationRow>(db, "SELECT * FROM integrations")) {
    await syncIntegration(db, i, clientFor(i, fetchImpl)).catch((err) => console.error(`[n8n] ${i.name}: ${(err as Error).message}`));
  }
}

/** How much Orvanta can really do on this agent, in words a manager understands. */
export function controlLevel(agent: Pick<AgentRow, "source" | "last_check_at">, now = Date.now()) {
  const checks = agent.last_check_at !== null && agent.last_check_at !== undefined;
  const recent = checks && now - (agent.last_check_at ?? 0) < 30 * 24 * HOUR;
  if (recent) {
    return {
      level: "control" as const,
      label: tr("Checked before acting", "Contrôle avant action"),
      detail: tr(`It asks for permission before its sensitive actions: ${PRODUCT_NAME} can block them.`, `Il demande la permission avant ses actions sensibles : ${PRODUCT_NAME} peut les bloquer.`),
    };
  }
  if (agent.source === "n8n") {
    return {
      level: "stop" as const,
      label: tr("Monitoring + emergency stop", "Supervision + arrêt d'urgence"),
      detail: tr(
        `${PRODUCT_NAME} reads its executions and can switch the workflow off in n8n, but it does not ask for permission before acting yet.`,
        `${PRODUCT_NAME} lit ses exécutions et peut désactiver le workflow dans n8n, mais il ne demande pas encore la permission avant d'agir.`,
      ),
    };
  }
  return {
    level: "watch" as const,
    label: tr("Monitoring", "Supervision"),
    detail: tr(
      `${PRODUCT_NAME} sees what it reports. Pausing only works if it checks with ${PRODUCT_NAME} before acting.`,
      `${PRODUCT_NAME} voit ce qu'il déclare. La pause n'agit que s'il consulte ${PRODUCT_NAME} avant d'agir.`,
    ),
  };
}
