/**
 * Brings the demo workspace to life: a handful of agents work through the
 * real SDK, respect pauses and wait for human decisions.
 *
 *   npm run simulate              (server on http://localhost:8787)
 *   AGENT_HQ_URL=… ADMIN_TOKEN=… npm run simulate
 */
import { ActionRefused, Orbyn } from "../sdk/orbyn.ts";

const URL_ = process.env.AGENT_HQ_URL ?? "http://localhost:8787";
const adminHeaders: Record<string, string> = process.env.ADMIN_TOKEN ? { "x-admin-token": process.env.ADMIN_TOKEN } : {};

interface Summary { id: string; name: string }
interface Detail { api_key: string; name: string; expected_language: string | null }

async function admin<T>(path: string): Promise<T> {
  const res = await fetch(URL_ + path, { headers: adminHeaders });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface Script {
  support: string;
  refunds: string;
  actions: Record<string, string>;
  /** Mostly good answers, a few that the AI reviewer should catch. */
  qa: Array<[string, string]>;
  customers: string[];
  refund: (amount: number, who: string) => string;
  context: string;
  log: { start: (n: number) => string; paused: (name: string) => string; refunded: (name: string, amount: number, who: string) => string; stopped: string };
}

const EN: Script = {
  support: "customer-support",
  refunds: "refunds",
  actions: {
    "customer-support": "zendesk.reply",
    "review-replies": "google.reply",
    "bank-reconciliation": "quickbooks.update",
    "delivery-planning": "calendar.create",
    "resume-screening": "ats.update",
  },
  qa: [
    ["Where is my order 5530?", "Hi! Your order 5530 shipped yesterday; you'll get the tracking number by email today."],
    ["Can I change the delivery address?", "Hi, yes, as long as the package hasn't shipped. I've just passed your request on to the warehouse."],
    ["I don't like the product, can I return it after 45 days?", "Of course, you have 90 days to send it back, and we even refund the shipping costs."],
    ["Do you have a store in Chicago?", "Hi, we don't have a physical store: we only sell online."],
    ["I didn't get my invoice.", "Hola, le acabo de reenviar la factura a su correo electrónico."],
  ],
  customers: ["Mrs. Bennett", "Corner Café", "Mr. Nguyen", "Sunrise Bakery"],
  refund: (amount, who) => `Refund $${amount / 100} to ${who}`,
  context: "Item arrived damaged, photos sent by the customer.",
  log: {
    start: (n) => `Simulating ${n} agents on ${URL_} (Ctrl+C to stop)`,
    paused: (name) => `⏸  ${name} is paused, waiting.`,
    refunded: (name, amount, who) => `💵 ${name}: $${amount / 100} refunded to ${who}`,
    stopped: "The simulation stopped:",
  },
};

const FR: Script = {
  support: "support-client-fr",
  refunds: "remboursements",
  actions: {
    "support-client-fr": "zendesk.reply",
    "moderation-avis": "google.reply",
    "rapprochement-bancaire": "pennylane.update",
    "planification-livraisons": "calendar.create",
    "tri-candidatures": "ats.update",
  },
  qa: [
    ["Où en est ma commande 5530 ?", "Bonjour ! Votre commande 5530 a été expédiée hier, vous recevrez le numéro de suivi par e-mail aujourd'hui."],
    ["Puis-je changer l'adresse de livraison ?", "Bonjour, oui tant que le colis n'est pas expédié. Je viens de transmettre votre demande à l'entrepôt."],
    ["Le produit ne me plaît pas, puis-je le retourner après 45 jours ?", "Bien sûr, vous avez 90 jours pour nous le retourner, et nous vous remboursons même les frais de port."],
    ["Avez-vous un magasin à Lyon ?", "Bonjour, nous n'avons pas de magasin physique : nous vendons uniquement en ligne."],
    ["Je n'ai pas reçu ma facture.", "Hello, I have just sent your invoice again to your e-mail address."],
  ],
  customers: ["Mme Bernard", "Café des Arts", "M. Nguyen", "Boulangerie Lemoine"],
  refund: (amount, who) => `Rembourser ${amount / 100} € à ${who}`,
  context: "Article reçu abîmé, photos jointes par le client.",
  log: {
    start: (n) => `Simulation de ${n} agents sur ${URL_} (Ctrl+C pour arrêter)`,
    paused: (name) => `⏸  ${name} est en pause, il attend.`,
    refunded: (name, amount, who) => `💶 ${name} : ${amount / 100} € remboursés à ${who}`,
    stopped: "La simulation s'est arrêtée :",
  },
};

let S = EN;

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Same language as the server's demo workspace.
  if ((await admin<{ language: string }>("/api/locale")).language === "fr") S = FR;
  const agents = await admin<Summary[]>("/api/agents");
  const chosen = agents.filter((a) => a.id in S.actions || a.id === S.refunds).slice(0, 8);
  const clients = await Promise.all(
    chosen.map(async (a) => {
      const d = await admin<Detail>(`/api/agents/${a.id}`);
      return { id: a.id, name: d.name, lang: d.expected_language, hq: new Orbyn({ url: URL_, key: d.api_key }) };
    }),
  );
  console.log(S.log.start(clients.length));

  let tick = 0;
  let refundPending = false;
  for (;;) {
    tick++;
    const c = pick(clients);
    const cfg = await c.hq.config();
    if (cfg.paused) {
      if (tick % 20 === 0) console.log(S.log.paused(c.name));
      await sleep(400);
      continue;
    }

    if (c.id === S.refunds) {
      // One refund at a time, and not too often: humans have other things to do.
      if (refundPending || Math.random() > 0.2) { await sleep(300); continue; }
      refundPending = true;
      const amount = pick([4500, 8900, 12000, 26000, 41000]);
      const who = pick(S.customers);
      c.hq
        .guard(
          { action: "stripe.refund", amount_cents: amount, target: who, summary: S.refund(amount, who), context: S.context },
          async () => sleep(200),
          { cost_cents: 9, waitMs: 10 * 60_000 },
        )
        .then(() => console.log(S.log.refunded(c.name, amount, who)))
        .catch((err) => console.log(`✋ ${c.name} : ${err instanceof ActionRefused ? err.reason : err.message}`))
        .finally(() => { refundPending = false; });
    } else {
      const cheap = cfg.model_tier === "economy";
      const qa = c.id === S.support ? pick(S.qa) : null;
      await c.hq.report({
        ...(qa ? { input: qa[0], output: qa[1] } : {}),
        kind: "task",
        action: S.actions[c.id],
        target: `${c.id}-${Date.now()}`,
        success: Math.random() > 0.03,
        cost_cents: (cheap ? 1.5 : 4) * (0.7 + Math.random() * 0.6),
        language: c.lang ?? undefined,
      });
    }
    await sleep(250 + Math.random() * 500);
  }
}

main().catch((err) => {
  console.error(S.log.stopped, err.message);
  process.exit(1);
});
