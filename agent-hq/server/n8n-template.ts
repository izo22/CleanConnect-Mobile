/**
 * The "ask before acting" block for n8n, ready to paste into a workflow
 * (n8n accepts nodes pasted as JSON). It goes right before the sensitive step:
 *
 *   Demander l'autorisation → Autorisé ? ──oui──────────────────────────→ [votre action]
 *                                  └─non→ Validation demandée ? ─oui→ Attendre le feu vert → Feu vert ? ─oui→ [votre action]
 *                                              └─non (refusé) → Refusé          └─non (refusé ou délai dépassé) → Refusé
 *
 * If Agent HQ cannot be reached, the HTTP node fails and the workflow stops:
 * the sensitive action is NOT executed (fail closed).
 */
import { randomUUID } from "node:crypto";

const condition = (left: string, right: string) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
    conditions: [{ id: randomUUID(), leftValue: left, rightValue: right, operator: { type: "string", operation: "equals" } }],
    combinator: "and",
  },
  options: {},
});

export interface SnippetOptions {
  /** Expression giving the action name, e.g. "stripe.refund". */
  action?: string;
  /** n8n expression (without "={{ }}") for the amount in cents, or null. */
  amountCents?: string | null;
  /** n8n expression (without "={{ }}") for the sentence shown to the human. */
  summary?: string;
}

export function n8nSnippet(agentHqUrl: string, agentKey: string, opts: SnippetOptions = {}) {
  const action = opts.action ?? "action.sensible";
  const summary = opts.summary ?? "'Action sensible demandée par le workflow ' + $workflow.name";
  const amount = opts.amountCents === undefined ? null : opts.amountCents;
  const body = [
    `action: '${action}'`,
    amount ? `amount_cents: ${amount}` : null,
    `summary: ${summary}`,
    `context: 'Exécution n8n ' + $execution.id`,
    `callback_url: $execution.resumeUrl`,
  ].filter(Boolean).join(", ");

  const nodes = [
    {
      name: "Agent HQ · Demander l'autorisation",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [0, 0],
      parameters: {
        method: "POST",
        url: `${agentHqUrl.replace(/\/+$/, "")}/api/v1/check`,
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "Authorization", value: `Bearer ${agentKey}` }] },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={{ JSON.stringify({ ${body} }) }}`,
        options: { timeout: 15000 },
      },
    },
    { name: "Agent HQ · Autorisé ?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [240, 0], parameters: condition("={{ $json.decision }}", "allow") },
    { name: "Agent HQ · Validation demandée ?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [480, 140], parameters: condition("={{ $json.decision }}", "needs_approval") },
    {
      name: "Agent HQ · Attendre le feu vert",
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: [720, 60],
      webhookId: randomUUID(),
      parameters: { resume: "webhook", httpMethod: "POST", limitWaitTime: true, limitType: "afterTimeInterval", resumeAmount: 24, resumeUnit: "hours", options: {} },
    },
    { name: "Agent HQ · Feu vert ?", type: "n8n-nodes-base.if", typeVersion: 2.2, position: [960, 60], parameters: condition("={{ String($json.body?.approved === true) }}", "true") },
    { name: "Votre action sensible (à remplacer)", type: "n8n-nodes-base.noOp", typeVersion: 1, position: [1200, -40], parameters: {} },
    { name: "Agent HQ · Refusé", type: "n8n-nodes-base.noOp", typeVersion: 1, position: [1200, 240], parameters: {} },
  ];

  const go = (node: string) => [{ node, type: "main", index: 0 }];
  const connections = {
    "Agent HQ · Demander l'autorisation": { main: [go("Agent HQ · Autorisé ?")] },
    "Agent HQ · Autorisé ?": { main: [go("Votre action sensible (à remplacer)"), go("Agent HQ · Validation demandée ?")] },
    "Agent HQ · Validation demandée ?": { main: [go("Agent HQ · Attendre le feu vert"), go("Agent HQ · Refusé")] },
    "Agent HQ · Attendre le feu vert": { main: [go("Agent HQ · Feu vert ?")] },
    "Agent HQ · Feu vert ?": { main: [go("Votre action sensible (à remplacer)"), go("Agent HQ · Refusé")] },
  };

  return { nodes, connections };
}
