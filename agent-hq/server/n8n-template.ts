/**
 * The "ask before acting" block for n8n, ready to paste into a workflow
 * (n8n accepts nodes pasted as JSON). It goes right before the sensitive step:
 *
 *   Ask for permission → Allowed? ──yes─────────────────────────────→ [your action]
 *                           └─no→ Approval requested? ─yes→ Wait for the green light → Green light? ─yes→ [your action]
 *                                      └─no (refused) → Declined            └─no (declined or timed out) → Declined
 *
 * If Orvanta cannot be reached, the HTTP node fails and the workflow stops:
 * the sensitive action is NOT executed (fail closed).
 */
import { randomUUID } from "node:crypto";
import { tr } from "./i18n.ts";
import { PRODUCT_NAME } from "./brand.ts";

const condition = (left: string, right: string) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
    conditions: [{ id: randomUUID(), leftValue: left, rightValue: right, operator: { type: "string", operation: "equals" } }],
    combinator: "and",
  },
  options: {},
});

export interface SnippetOptions {
  /** Action name, e.g. "stripe.refund". */
  action?: string;
  /** n8n expression (without "={{ }}") for the amount in cents, or null. */
  amountCents?: string | null;
  /** n8n expression (without "={{ }}") for the sentence shown to the human. */
  summary?: string;
}

export function n8nSnippet(agentHqUrl: string, agentKey: string, opts: SnippetOptions = {}) {
  const action = opts.action ?? tr("sensitive.action", "action.sensible");
  const summary = opts.summary ?? tr("'Sensitive action requested by the workflow ' + $workflow.name", "'Action sensible demandée par le workflow ' + $workflow.name");
  const amount = opts.amountCents === undefined ? null : opts.amountCents;
  const body = [
    `action: '${action}'`,
    amount ? `amount_cents: ${amount}` : null,
    `summary: ${summary}`,
    `context: ${tr("'n8n execution '", "'Exécution n8n '")} + $execution.id`,
    `callback_url: $execution.resumeUrl`,
  ].filter(Boolean).join(", ");

  const N = {
    ask: tr(`${PRODUCT_NAME} · Ask for permission`, `${PRODUCT_NAME} · Demander l'autorisation`),
    allowed: tr(`${PRODUCT_NAME} · Allowed?`, `${PRODUCT_NAME} · Autorisé ?`),
    requested: tr(`${PRODUCT_NAME} · Approval requested?`, `${PRODUCT_NAME} · Validation demandée ?`),
    wait: tr(`${PRODUCT_NAME} · Wait for the green light`, `${PRODUCT_NAME} · Attendre le feu vert`),
    green: tr(`${PRODUCT_NAME} · Green light?`, `${PRODUCT_NAME} · Feu vert ?`),
    action: tr("Your sensitive action (replace me)", "Votre action sensible (à remplacer)"),
    refused: tr(`${PRODUCT_NAME} · Declined`, `${PRODUCT_NAME} · Refusé`),
  };

  const nodes = [
    {
      name: N.ask,
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
    { name: N.allowed, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [240, 0], parameters: condition("={{ $json.decision }}", "allow") },
    { name: N.requested, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [480, 140], parameters: condition("={{ $json.decision }}", "needs_approval") },
    {
      name: N.wait,
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: [720, 60],
      webhookId: randomUUID(),
      parameters: { resume: "webhook", httpMethod: "POST", limitWaitTime: true, limitType: "afterTimeInterval", resumeAmount: 24, resumeUnit: "hours", options: {} },
    },
    { name: N.green, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [960, 60], parameters: condition("={{ String($json.body?.approved === true) }}", "true") },
    { name: N.action, type: "n8n-nodes-base.noOp", typeVersion: 1, position: [1200, -40], parameters: {} },
    { name: N.refused, type: "n8n-nodes-base.noOp", typeVersion: 1, position: [1200, 240], parameters: {} },
  ];

  const go = (node: string) => [{ node, type: "main", index: 0 }];
  const connections = {
    [N.ask]: { main: [go(N.allowed)] },
    [N.allowed]: { main: [go(N.action), go(N.requested)] },
    [N.requested]: { main: [go(N.wait), go(N.refused)] },
    [N.wait]: { main: [go(N.green)] },
    [N.green]: { main: [go(N.action), go(N.refused)] },
  };

  return { nodes, connections };
}
