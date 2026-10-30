/**
 * "Protect a step": Orvanta inserts its permission check right before a
 * sensitive step of an n8n workflow, so nobody has to edit the workflow by
 * hand. The step still receives exactly the items it used to:
 *
 *   [before] → ask → allowed? ─yes──────────────────────────────→ continue → [step]
 *                       └no→ approval? ─yes→ wait → approved? ─yes┘
 *                                └no→ declined          └no→ declined
 *
 * If Orvanta can't be reached, "ask" fails and the step never runs. The
 * workflow as it was is kept, so the change can be undone.
 */
import { randomUUID } from "node:crypto";
import { get, run, type DB } from "./db.ts";
import { tr } from "./i18n.ts";
import { logActivity, type AgentRow } from "./model.ts";
import { N8nError, clientFor, getIntegration, updatingWorkflows, type N8nClient, type N8nConnections, type N8nNode, type N8nWorkflow } from "./n8n.ts";
import { condition } from "./n8n-template.ts";

/** A request that can't be done as asked (shown as is, not as an n8n outage). */
const refuse = (message: string) => Object.assign(new Error(message), { statusCode: 409 });

export interface ProtectSettings {
  /** true: the step always waits for a human. false: the guardrails decide (amount thresholds, trust level, AI check). */
  always: boolean;
  /** Field of the item that holds an amount in currency units, so amount thresholds apply. */
  amountField?: string;
  /** With amountField: above this amount (in cents), a human decides. Saved as a guardrail. */
  maxAmountCents?: number;
}

/** The action name the protected step reports, which guardrails match on. */
export const actionNameFor = (step: string) => "n8n." + (step.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "step");

const PREFIX = "Orvanta · ";
/** Room the inserted nodes take on the canvas: the step and everything after it move right by this much. */
const WIDTH = 1440;

export const gateNames = (step: string) => ({
  ask: `${PREFIX}${tr("ask", "demander")} (${step})`,
  allowed: `${PREFIX}${tr("allowed?", "autorisé ?")} (${step})`,
  requested: `${PREFIX}${tr("approval asked?", "validation demandée ?")} (${step})`,
  wait: `${PREFIX}${tr("wait for the decision", "attendre la décision")} (${step})`,
  approved: `${PREFIX}${tr("approved?", "approuvé ?")} (${step})`,
  declined: `${PREFIX}${tr("declined", "refusé")} (${step})`,
  cont: `${PREFIX}${tr("go ahead", "continuer")} (${step})`,
});

const isTrigger = (n: N8nNode) => /trigger$/i.test(n.type) || n.type === "n8n-nodes-base.webhook" || n.type === "n8n-nodes-base.formTrigger";

/** Every connection that ends on `step`, as [source node, output index, position in that output]. */
function incoming(connections: N8nConnections, step: string) {
  const found: Array<{ from: string; output: number; at: number; index: number }> = [];
  for (const [from, types] of Object.entries(connections)) {
    (types.main ?? []).forEach((targets, output) =>
      (targets ?? []).forEach((c, at) => { if (c.node === step) found.push({ from, output, at, index: c.index }); }),
    );
  }
  return found;
}

export interface StepView { name: string; type: string; protected: boolean; protectable: boolean; reason: string | null }

/** The steps of a workflow, and whether each can be protected. */
export function stepsOf(wf: Pick<N8nWorkflow, "nodes" | "connections">): StepView[] {
  const connections = wf.connections ?? {};
  return (wf.nodes ?? [])
    .filter((n) => n.type !== "n8n-nodes-base.stickyNote" && !n.name.startsWith(PREFIX))
    .map((n) => {
      const ins = incoming(connections, n.name);
      const sources = [...new Set(ins.map((c) => c.from))];
      // Fed only by Orvanta's "go ahead" node (named in whichever language the instance had then).
      const isProtected = sources.length === 1 && sources[0].startsWith(PREFIX) && sources[0].endsWith(`(${n.name})`);
      let reason: string | null = null;
      if (isTrigger(n) || ins.length === 0) reason = tr("It starts the workflow: nothing happens before it.", "Elle démarre le workflow : rien ne se passe avant elle.");
      else if (sources.length > 1 || ins.some((c) => c.index !== 0)) reason = tr("It has several inputs: add the block by hand.", "Elle a plusieurs entrées : ajoutez le bloc à la main.");
      return { name: n.name, type: n.type, protected: isProtected, protectable: !reason && !isProtected, reason: isProtected ? null : reason };
    });
}

/** The workflow with the check inserted before `step`. Pure: nothing is sent anywhere. */
export function insertGate(
  wf: Pick<N8nWorkflow, "nodes" | "connections">,
  step: string,
  settings: ProtectSettings,
  ctx: { orvantaUrl: string; agentKey: string },
): { nodes: N8nNode[]; connections: N8nConnections } {
  const view = stepsOf(wf).find((s) => s.name === step);
  if (!view) throw refuse(tr("This step is no longer in the workflow.", "Cette étape n'est plus dans le workflow."));
  if (view.protected) throw refuse(tr("This step is already protected.", "Cette étape est déjà protégée."));
  if (!view.protectable) throw refuse(view.reason!);

  const connections: N8nConnections = JSON.parse(JSON.stringify(wf.connections ?? {}));
  const ins = incoming(connections, step);
  const before = ins[0].from;
  const target = wf.nodes!.find((n) => n.name === step)!;
  const [x, y] = target.position;
  const N = gateNames(step);

  // Make room: the step and everything to its right move right.
  const nodes: N8nNode[] = wf.nodes!.map((n) => (n.position[0] >= x ? { ...n, position: [n.position[0] + WIDTH, n.position[1]] as [number, number] } : n));
  // What was wired to the step now goes through the check.
  for (const c of ins) connections[c.from].main![c.output]![c.at] = { node: N.ask, type: "main", index: 0 };

  const amount = settings.amountField?.trim()
    ? `, amount_cents: Math.round(Number($json[${JSON.stringify(settings.amountField.trim())}]) * 100) || undefined`
    : "";
  const body = `action: ${JSON.stringify(actionNameFor(step))}`
    + `, summary: ${JSON.stringify(step + " · ")} + $workflow.name`
    // The details read in Decisions: "customer: Dana Brooks · amount: 18400".
    + `, context: Object.entries($json).map(([k, v]) => k + ": " + (typeof v === "object" ? JSON.stringify(v) : v)).join(" · ").slice(0, 1500)`
    + `, callback_url: $execution.resumeUrl`
    + (settings.always ? ", require_approval: true" : "")
    + amount;
  const go = (node: string) => [{ node, type: "main", index: 0 }];

  nodes.push(
    {
      name: N.ask, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [x, y],
      parameters: {
        method: "POST",
        url: `${ctx.orvantaUrl.replace(/\/+$/, "")}/api/v1/check`,
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "Authorization", value: `Bearer ${ctx.agentKey}` }] },
        sendBody: true, specifyBody: "json",
        jsonBody: `={{ JSON.stringify({ ${body} }) }}`,
        options: { timeout: 15000 },
      },
    },
    { name: N.allowed, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [x + 220, y], parameters: condition("={{ $json.decision }}", "allow") },
    { name: N.requested, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [x + 440, y + 160], parameters: condition("={{ $json.decision }}", "needs_approval") },
    {
      name: N.wait, type: "n8n-nodes-base.wait", typeVersion: 1.1, position: [x + 660, y + 80], webhookId: randomUUID(),
      parameters: { resume: "webhook", httpMethod: "POST", limitWaitTime: true, limitType: "afterTimeInterval", resumeAmount: 24, resumeUnit: "hours", options: {} },
    },
    { name: N.approved, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [x + 880, y + 80], parameters: condition("={{ String($json.body?.approved === true) }}", "true") },
    { name: N.declined, type: "n8n-nodes-base.noOp", typeVersion: 1, position: [x + 1100, y + 260], parameters: {} },
    {
      // The step gets the items it would have received without the check, not Orvanta's answer.
      name: N.cont, type: "n8n-nodes-base.code", typeVersion: 2, position: [x + 1100, y],
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: [
          "// Orvanta: give the next step the items it received before the permission check.",
          "return $input.all().map((_, i) => {",
          `  const original = $(${JSON.stringify(before)}).itemMatching(i);`,
          "  return original.binary ? { json: original.json, binary: original.binary } : { json: original.json };",
          "});",
        ].join("\n"),
      },
    },
  );
  connections[N.ask] = { main: [go(N.allowed)] };
  connections[N.allowed] = { main: [go(N.cont), go(N.requested)] };
  connections[N.requested] = { main: [go(N.wait), go(N.declined)] };
  connections[N.wait] = { main: [go(N.approved)] };
  connections[N.approved] = { main: [go(N.cont), go(N.declined)] };
  connections[N.cont] = { main: [go(step)] };
  return { nodes, connections };
}

// ---------- Talking to n8n ----------

/** n8n's public API refuses settings it does not know: keep only the documented ones. */
const SETTINGS = ["saveExecutionProgress", "saveManualExecutions", "saveDataErrorExecution", "saveDataSuccessExecution", "executionTimeout", "errorWorkflow", "timezone", "executionOrder", "callerPolicy"];
const knownSettings = (s: Record<string, unknown> = {}) => Object.fromEntries(Object.entries(s).filter(([k]) => SETTINGS.includes(k)));

/** A published workflow is switched off, rewritten and switched back on, the order n8n accepts. */
async function write(client: N8nClient, wf: N8nWorkflow, next: Pick<N8nWorkflow, "nodes" | "connections">) {
  updatingWorkflows.add(wf.id);
  try {
    if (wf.active) await client.deactivate(wf.id);
    try {
      await client.updateWorkflow(wf.id, { name: wf.name, nodes: next.nodes, connections: next.connections, settings: knownSettings(wf.settings) });
    } catch (err) {
      if (wf.active) await client.activate(wf.id).catch(() => {});
      if (err instanceof N8nError && (err.status === 401 || err.status === 403)) {
        throw new N8nError(tr(
          "n8n doesn't let Orvanta change this workflow: give the API key the “workflow:update” permission (or “All”).",
          "n8n ne laisse pas Orvanta modifier ce workflow : donnez à la clé API le droit « workflow:update » (ou « All »).",
        ), err.status);
      }
      throw err;
    }
    if (wf.active) await client.activate(wf.id);
  } finally {
    updatingWorkflows.delete(wf.id);
  }
}

function workflowOf(db: DB, agent: AgentRow, fetchImpl?: typeof fetch) {
  if (agent.source !== "n8n" || !agent.integration_id || !agent.external_id) {
    throw refuse(tr("Only agents read from n8n can be protected this way.", "Seuls les agents lus depuis n8n peuvent être protégés ainsi."));
  }
  const integration = getIntegration(db, agent.integration_id);
  if (!integration) throw refuse(tr("This agent's n8n connection was deleted.", "La connexion n8n de cet agent a été supprimée."));
  return { client: clientFor(integration, fetchImpl), id: agent.external_id };
}

export async function listSteps(db: DB, agent: AgentRow, fetchImpl?: typeof fetch) {
  const { client, id } = workflowOf(db, agent, fetchImpl);
  const wf = await client.getWorkflow(id);
  const canUndo = !!get(db, "SELECT 1 FROM workflow_backups WHERE agent_id = ?", agent.id);
  return { steps: stepsOf(wf), can_undo: canUndo };
}

export async function protectStep(
  db: DB, agent: AgentRow, step: string, settings: ProtectSettings,
  opts: { orvantaUrl: string; actor: string; now: number; fetchImpl?: typeof fetch },
) {
  const { client, id } = workflowOf(db, agent, opts.fetchImpl);
  const wf = await client.getWorkflow(id);
  const next = insertGate(wf, step, settings, { orvantaUrl: opts.orvantaUrl, agentKey: agent.api_key });
  run(db, "INSERT INTO workflow_backups (agent_id, workflow, label, created_at) VALUES (?, ?, ?, ?)",
    agent.id, JSON.stringify({ nodes: wf.nodes, connections: wf.connections }), step, opts.now);
  // Keep the last 10 versions per agent.
  run(db, "DELETE FROM workflow_backups WHERE agent_id = ? AND id NOT IN (SELECT id FROM workflow_backups WHERE agent_id = ? ORDER BY id DESC LIMIT 10)", agent.id, agent.id);
  await write(client, wf, next);
  if (!settings.always && settings.amountField?.trim() && settings.maxAmountCents !== undefined) {
    // "Ask me above this amount" is an ordinary guardrail, visible and editable on the Guardrails page.
    run(
      db,
      `INSERT INTO rules (id, workspace_id, kind, label, params, enabled, trigger_count, created_at) VALUES (?, ?, 'approval_amount', ?, ?, 1, 0, ?)
       ON CONFLICT (id) DO UPDATE SET params = excluded.params, enabled = 1`,
      `${agent.workspace_id}:${agent.id}:${actionNameFor(step)}`, agent.workspace_id, step,
      JSON.stringify({ action_prefix: actionNameFor(step), max_cents: settings.maxAmountCents }), opts.now,
    );
  }
  logActivity(db, opts.actor, settings.always
    ? tr(`Step “${step}” protected: it now always waits for a human decision.`, `Étape « ${step} » protégée : elle attend toujours une décision humaine.`)
    : tr(`Step “${step}” protected: it now asks permission and follows the guardrails.`, `Étape « ${step} » protégée : elle demande la permission et suit les garde-fous.`), agent.id, opts.now);
}

/** Puts back the workflow as it was before the last protection. */
export async function undoLastProtection(db: DB, agent: AgentRow, opts: { actor: string; now: number; fetchImpl?: typeof fetch }) {
  const backup = get<{ id: number; workflow: string; label: string }>(db, "SELECT id, workflow, label FROM workflow_backups WHERE agent_id = ? ORDER BY id DESC LIMIT 1", agent.id);
  if (!backup) throw refuse(tr("There is no change to undo.", "Il n'y a pas de modification à annuler."));
  const { client, id } = workflowOf(db, agent, opts.fetchImpl);
  const wf = await client.getWorkflow(id);
  await write(client, wf, JSON.parse(backup.workflow));
  run(db, "DELETE FROM workflow_backups WHERE id = ?", backup.id);
  logActivity(db, opts.actor, tr(`Protection of “${backup.label}” removed: the workflow is back as it was.`, `Protection de « ${backup.label} » retirée : le workflow est revenu comme avant.`), agent.id, opts.now);
}
