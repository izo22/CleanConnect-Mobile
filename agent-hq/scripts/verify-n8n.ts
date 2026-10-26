/**
 * End-to-end proof of the n8n integration against a REAL n8n instance.
 *
 *   AGENT_HQ_URL=http://localhost:8787 \
 *   N8N_URL=http://localhost:5678 \
 *   N8N_HQ_KEY=<key with workflow:list/read/activate/deactivate, execution:list/read> \
 *   N8N_SETUP_KEY=<key that may also create/update/delete workflows> \
 *   npm run verify:n8n
 *
 * It creates three workflows in n8n, connects Agent HQ, and checks the three
 * levels: supervision, emergency stop, and control before acting (approve,
 * refuse, allowed directly, Agent HQ unreachable). A fake payment service on
 * port 9999 records which refunds really went out.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const HQ = process.env.AGENT_HQ_URL ?? "http://localhost:8787";
const N8N = process.env.N8N_URL ?? "http://localhost:5678";
const HQ_KEY = process.env.N8N_HQ_KEY ?? "";
const SETUP_KEY = process.env.N8N_SETUP_KEY ?? "";
const FAKE = "http://localhost:9999";

if (!HQ_KEY || !SETUP_KEY) {
  console.error("N8N_HQ_KEY et N8N_SETUP_KEY sont requis.");
  process.exit(1);
}

// ---------- Fake payment service + fake HubSpot ----------
const refunds: Array<{ amount: number; customer: string }> = [];
const fake = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/refund") {
      refunds.push(JSON.parse(body || "{}"));
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    } else if (req.url === "/hubspot") {
      res.writeHead(401, { "content-type": "application/json" }).end('{"status":"error","message":"Authentication credentials not found. OAuth access token expired."}');
    } else res.writeHead(404).end();
  });
});
await new Promise<void>((r) => fake.listen(9999, r));

// ---------- Helpers ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function http<T = any>(url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<{ status: number; json: T }> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as T };
}
const n8n = (path: string, init: { method?: string; body?: unknown } = {}) => http(`${N8N}/api/v1${path}`, { ...init, headers: { "X-N8N-API-KEY": SETUP_KEY } });
const hq = (path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) => http(`${HQ}${path}`, init);
async function until<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 20_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  throw new Error(`délai dépassé : ${what}`);
}

/** n8n opens/closes a webhook a fraction of a second after (de)activation. */
async function webhookState(path: string, want: "open" | "closed", timeoutMs = 5000) {
  const start = Date.now();
  let status = 0;
  while (Date.now() - start < timeoutMs) {
    status = (await fetch(`${N8N}/webhook/${path}`, { method: "POST" })).status;
    if ((want === "open") === (status < 400)) return { ok: true, ms: Date.now() - start, status };
    await sleep(200);
  }
  return { ok: false, ms: Date.now() - start, status };
}

const results: Array<[boolean, string, string]> = [];
async function step(name: string, fn: () => Promise<string | void>) {
  try {
    results.push([true, name, (await fn()) ?? ""]);
  } catch (err) {
    results.push([false, name, (err as Error).message]);
  }
}
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

// ---------- Workflows ----------
const webhook = (path: string) => ({
  name: "Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [-240, 0], webhookId: randomUUID(),
  parameters: { httpMethod: "POST", path, responseMode: "onReceived", options: {} },
});
const httpNode = (name: string, method: string, url: string, jsonBody?: string, position = [1440, -40]) => ({
  name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position,
  parameters: { method, url, ...(jsonBody ? { sendBody: true, specifyBody: "json", jsonBody } : {}), options: {} },
});
const settings = { executionOrder: "v1", saveDataSuccessExecution: "all", saveDataErrorExecution: "all" };
const suffix = Date.now().toString(36);

async function createWorkflow(name: string, nodes: unknown[], connections: unknown) {
  const res = await n8n("/workflows", { method: "POST", body: { name, nodes, connections, settings } });
  if (res.status >= 300) throw new Error(`création « ${name} » : ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
  return res.json.id as string;
}

console.log(`Agent HQ : ${HQ} · n8n : ${N8N}\n`);

const wfSync = await createWorkflow(`Synchro HubSpot ${suffix}`,
  [webhook(`hubspot-${suffix}`), httpNode("HubSpot · mise à jour du contact", "GET", `${FAKE}/hubspot`, undefined, [0, 0])],
  { Webhook: { main: [[{ node: "HubSpot · mise à jour du contact", type: "main", index: 0 }]] } });
const wfRelance = await createWorkflow(`Relances clients ${suffix}`,
  [webhook(`relance-${suffix}`), { name: "Envoyer la relance", type: "n8n-nodes-base.noOp", typeVersion: 1, position: [0, 0], parameters: {} }],
  { Webhook: { main: [[{ node: "Envoyer la relance", type: "main", index: 0 }]] } });
const wfRefund = await createWorkflow(`Remboursements clients ${suffix}`,
  [webhook(`remboursement-${suffix}`), httpNode("Rembourser (paiement simulé)", "POST", `${FAKE}/refund`, "={{ JSON.stringify({ amount: $json.body.amount, customer: $json.body.customer }) }}", [0, 0])],
  { Webhook: { main: [[{ node: "Rembourser (paiement simulé)", type: "main", index: 0 }]] } });
for (const id of [wfSync, wfRelance, wfRefund]) await n8n(`/workflows/${id}/activate`, { method: "POST" });

// ---------- Level 1: supervision ----------
let integrationId = 0;
const agentOf = async (wfId: string) => {
  const list = (await hq("/api/agents")).json as Array<{ id: string; name: string }>;
  const id = `n8n-${integrationId}-${wfId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return list.find((a) => a.id === id) ? (await hq(`/api/agents/${id}`)).json : null;
};
const sync = () => hq(`/api/integrations/${integrationId}/sync`, { method: "POST", body: {} });

await step("Connexion : Agent HQ se connecte à n8n avec une clé aux droits limités", async () => {
  const res = await hq("/api/integrations", { method: "POST", body: { name: "n8n de test", base_url: N8N, api_key: HQ_KEY } });
  assert(res.status === 201, `${res.status} ${JSON.stringify(res.json)}`);
  integrationId = res.json.id;
  return `${res.json.sync.workflows} workflows importés`;
});

await step("Mauvaise clé n8n refusée avec un message clair", async () => {
  const res = await hq("/api/integrations", { method: "POST", body: { base_url: N8N, api_key: "cle-invalide-123456" } });
  assert(res.status === 502, String(res.status));
  return res.json.error;
});

await step("Supervision : chaque workflow devient un agent, sans le modifier", async () => {
  const a = await agentOf(wfSync);
  assert(a && a.source === "n8n", "agent absent");
  return `« ${a.name} » · niveau : ${a.control.label}`;
});

await step("Supervision : des exécutions en échec dans n8n deviennent une alerte en français", async () => {
  for (let i = 0; i < 6; i++) await fetch(`${N8N}/webhook/hubspot-${suffix}`, { method: "POST" });
  await sleep(3000);
  await sync();
  const a = await agentOf(wfSync);
  const alerts = (await hq("/api/alerts")).json.open as Array<{ agent_id: string; title: string; cause: string; kind: string }>;
  const alert = alerts.find((x) => x.agent_id === a.id);
  if (!alert) throw new Error(`pas d'alerte (tâches 24 h : ${a.tasks_24h}, réussite : ${a.success_rate})`);
  return `${alert.title} — ${alert.cause}`;
});

// ---------- Level 2: emergency stop ----------
await step("Arrêt d'urgence : « Mettre en pause » désactive vraiment le workflow dans n8n", async () => {
  const a = await agentOf(wfRelance);
  const before = await webhookState(`relance-${suffix}`, "open");
  assert(before.ok, `le workflow ne répondait pas avant la pause (${before.status})`);
  const res = await hq(`/api/agents/${a.id}/actions/pause`, { method: "POST", body: {} });
  assert(res.status === 200, JSON.stringify(res.json));
  const wf = (await n8n(`/workflows/${wfRelance}`)).json;
  assert(wf.active === false, "toujours actif dans n8n");
  const after = await webhookState(`relance-${suffix}`, "closed");
  assert(after.ok, `le workflow répond encore (${after.status})`);
  return `plus aucun déclenchement ${after.ms} ms après le clic (n8n répond ${after.status})`;
});

await step("Arrêt d'urgence : si quelqu'un le réactive dans n8n, Agent HQ le coupe à nouveau", async () => {
  await n8n(`/workflows/${wfRelance}/activate`, { method: "POST" });
  await sync();
  const wf = (await n8n(`/workflows/${wfRelance}`)).json;
  assert(wf.active === false, "réactivé sans contrôle");
});

await step("« Reprendre » réactive le workflow", async () => {
  const a = await agentOf(wfRelance);
  await hq(`/api/agents/${a.id}/actions/resume`, { method: "POST", body: {} });
  const res = await webhookState(`relance-${suffix}`, "open");
  assert(res.ok, String(res.status));
  return `de nouveau actif après ${res.ms} ms`;
});

await step("Désactivé à la main dans n8n : Agent HQ l'affiche en pause, avec la raison", async () => {
  await n8n(`/workflows/${wfRelance}/deactivate`, { method: "POST" });
  await sync();
  const a = await agentOf(wfRelance);
  assert(a.paused && a.pause_reason === "désactivé dans n8n", `${a.paused} ${a.pause_reason}`);
  await n8n(`/workflows/${wfRelance}/activate`, { method: "POST" });
  await sync();
});

// ---------- Level 3: control before acting ----------
let refundAgent: any;
await step("Contrôle : le bloc « Demander l'autorisation » s'insère dans le workflow", async () => {
  refundAgent = await agentOf(wfRefund);
  const snippet = (await hq(`/api/agents/${refundAgent.id}/n8n-snippet`)).json;
  const ask = snippet.nodes.find((n: any) => n.name === "Agent HQ · Demander l'autorisation");
  // The agency adapts the request to its data: amount and sentence shown to the human.
  ask.parameters.jsonBody = "={{ JSON.stringify({ action: 'stripe.refund', amount_cents: Math.round($json.body.amount * 100), summary: 'Rembourser ' + $json.body.amount + ' € à ' + $json.body.customer, callback_url: $execution.resumeUrl }) }}";
  const action = httpNode("Rembourser (paiement simulé)", "POST", `${FAKE}/refund`,
    "={{ JSON.stringify({ amount: $('Webhook').item.json.body.amount, customer: $('Webhook').item.json.body.customer }) }}");
  const nodes = [webhook(`remboursement-${suffix}`), ...snippet.nodes.filter((n: any) => n.name !== "Votre action sensible (à remplacer)"), action];
  const rename = (c: any) => JSON.parse(JSON.stringify(c).replaceAll("Votre action sensible (à remplacer)", "Rembourser (paiement simulé)"));
  const connections = { Webhook: { main: [[{ node: "Agent HQ · Demander l'autorisation", type: "main", index: 0 }]] }, ...rename(snippet.connections) };
  await n8n(`/workflows/${wfRefund}/deactivate`, { method: "POST" });
  const res = await n8n(`/workflows/${wfRefund}`, { method: "PUT", body: { name: `Remboursements clients ${suffix}`, nodes, connections, settings } });
  assert(res.status === 200, `${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
  const act = await n8n(`/workflows/${wfRefund}/activate`, { method: "POST" });
  assert(act.status === 200, `${act.status} ${JSON.stringify(act.json).slice(0, 300)}`);
  await sleep(1000); // let n8n open the webhook
});

const trigger = async (amount: number, customer: string) => {
  const res = await fetch(`${N8N}/webhook/remboursement-${suffix}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount, customer }) });
  if (!res.ok) throw new Error(`n8n n'a pas pris la demande (${res.status})`);
};
const pendingFor = (title: string) => until(`demande « ${title} »`, async () =>
  ((await hq("/api/approvals")).json.pending as any[]).find((p) => p.title === title));

await step("Contrôle : remboursement de 340 € → le workflow s'arrête et attend, rien n'est payé", async () => {
  await trigger(340, "Brasserie du Port (n8n)");
  const p = await pendingFor("Rembourser 340 € à Brasserie du Port (n8n)");
  await sleep(2000);
  assert(!refunds.some((r) => r.amount === 340), "le remboursement est parti sans accord !");
  return `demande n° ${p.id} en attente, aucun paiement`;
});

await step("Contrôle : « Approuver » dans Agent HQ → n8n reprend et rembourse", async () => {
  const p = await pendingFor("Rembourser 340 € à Brasserie du Port (n8n)");
  await hq(`/api/approvals/${p.id}/decision`, { method: "POST", body: { approve: true }, headers: { "x-user-name": "Julie" } });
  await until("remboursement de 340 €", async () => refunds.find((r) => r.amount === 340));
  return "340 € remboursés après l'accord";
});

await step("Contrôle : « Refuser » → n8n reprend mais ne rembourse pas", async () => {
  await trigger(280, "Café des Arts (n8n)");
  const p = await pendingFor("Rembourser 280 € à Café des Arts (n8n)");
  await hq(`/api/approvals/${p.id}/decision`, { method: "POST", body: { approve: false } });
  await until("décision transmise", async () => ((await hq("/api/approvals")).json.decided as any[]).find((d) => d.id === p.id && d.callback_status === "sent"));
  await sleep(3000);
  assert(!refunds.some((r) => r.amount === 280), "remboursé malgré le refus !");
  return "aucun paiement de 280 €";
});

await step("Contrôle : petit montant (45 €) autorisé directement, sans attente", async () => {
  await trigger(45, "M. Nguyen");
  await until("remboursement de 45 €", async () => refunds.find((r) => r.amount === 45));
  const pending = ((await hq("/api/approvals")).json.pending as any[]).some((p) => p.title.includes("45 €"));
  assert(!pending, "une validation a été demandée pour 45 €");
});

await step("Contrôle : agent en pause dans Agent HQ → l'action est refusée même si le workflow tourne", async () => {
  const res = await hq("/api/v1/check", { method: "POST", headers: { authorization: `Bearer ${refundAgent.api_key}` }, body: { action: "stripe.refund", amount_cents: 1000 } });
  assert(res.json.decision === "allow", "état initial inattendu");
  await hq(`/api/agents/${refundAgent.id}/actions/pause`, { method: "POST", body: {} });
  const denied = await hq("/api/v1/check", { method: "POST", headers: { authorization: `Bearer ${refundAgent.api_key}` }, body: { action: "stripe.refund", amount_cents: 1000 } });
  await hq(`/api/agents/${refundAgent.id}/actions/resume`, { method: "POST", body: {} });
  assert(denied.json.decision === "deny", denied.json.decision);
  return denied.json.reason;
});

await step("Sécurité : si Agent HQ est injoignable, le remboursement n'est PAS exécuté", async () => {
  const snippet = (await hq(`/api/agents/${refundAgent.id}/n8n-snippet`)).json;
  const ask = snippet.nodes.find((n: any) => n.name === "Agent HQ · Demander l'autorisation");
  ask.parameters.url = "http://localhost:1/api/v1/check"; // nobody listens there
  ask.parameters.jsonBody = "={{ JSON.stringify({ action: 'stripe.refund', amount_cents: Math.round($json.body.amount * 100), callback_url: $execution.resumeUrl }) }}";
  const action = httpNode("Rembourser (paiement simulé)", "POST", `${FAKE}/refund`, "={{ JSON.stringify({ amount: $('Webhook').item.json.body.amount, customer: 'injoignable' }) }}");
  const nodes = [webhook(`injoignable-${suffix}`), ...snippet.nodes.filter((n: any) => n.name !== "Votre action sensible (à remplacer)"), action];
  const connections = { Webhook: { main: [[{ node: "Agent HQ · Demander l'autorisation", type: "main", index: 0 }]] }, ...JSON.parse(JSON.stringify(snippet.connections).replaceAll("Votre action sensible (à remplacer)", "Rembourser (paiement simulé)")) };
  const id = await createWorkflow(`Remboursements (Agent HQ injoignable) ${suffix}`, nodes, connections);
  await n8n(`/workflows/${id}/activate`, { method: "POST" });
  await sleep(1000);
  await fetch(`${N8N}/webhook/injoignable-${suffix}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: 77 }) });
  await sleep(4000);
  assert(!refunds.some((r) => r.customer === "injoignable"), "remboursé alors qu'Agent HQ était injoignable !");
  await n8n(`/workflows/${id}/deactivate`, { method: "POST" });
  await sleep(1000);
  await n8n(`/workflows/${id}`, { method: "DELETE" });
  return "le workflow s'arrête en erreur, aucun paiement";
});

await step("Les exécutions qui ont attendu une décision remontent aussi dans Agent HQ", async () => {
  await sync();
  const a = await agentOf(wfRefund);
  assert(a.tasks_24h >= 3, `tâches = ${a.tasks_24h}`);
  return `${a.tasks_24h} exécutions, niveau : ${a.control.label}`;
});

// ---------- Cleanup ----------
for (const id of [wfSync, wfRelance, wfRefund]) await n8n(`/workflows/${id}/deactivate`, { method: "POST" });
await sleep(1000); // n8n refuses to delete a workflow it is still switching off
for (const id of [wfSync, wfRelance, wfRefund]) await n8n(`/workflows/${id}`, { method: "DELETE" });
fake.close();

for (const [ok, name, detail] of results) console.log(`${ok ? "OK    " : "ÉCHEC "} ${name}${detail ? " — " + detail : ""}`);
const passed = results.filter((r) => r[0]).length;
console.log(`\n${passed}/${results.length} vérifications réussies`);
process.exit(passed === results.length ? 0 : 1);
