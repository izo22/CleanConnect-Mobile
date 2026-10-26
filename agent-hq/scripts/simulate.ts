/**
 * Brings the demo workspace to life: a handful of agents work through the
 * real SDK, respect pauses and wait for human decisions.
 *
 *   npm run simulate              (server on http://localhost:8787)
 *   AGENT_HQ_URL=… ADMIN_TOKEN=… npm run simulate
 */
import { AgentHQ, ActionRefused } from "../sdk/agent-hq.ts";

const URL_ = process.env.AGENT_HQ_URL ?? "http://localhost:8787";
const adminHeaders: Record<string, string> = process.env.ADMIN_TOKEN ? { "x-admin-token": process.env.ADMIN_TOKEN } : {};

interface Summary { id: string; name: string }
interface Detail { api_key: string; name: string; expected_language: string | null }

async function admin<T>(path: string): Promise<T> {
  const res = await fetch(URL_ + path, { headers: adminHeaders });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// Mostly good answers, a few that the AI reviewer should catch.
const SUPPORT_QA: Array<[string, string]> = [
  ["Où en est ma commande 5530 ?", "Bonjour ! Votre commande 5530 a été expédiée hier, vous recevrez le numéro de suivi par e-mail aujourd'hui."],
  ["Puis-je changer l'adresse de livraison ?", "Bonjour, oui tant que le colis n'est pas expédié. Je viens de transmettre votre demande à l'entrepôt."],
  ["Le produit ne me plaît pas, puis-je le retourner après 45 jours ?", "Bien sûr, vous avez 90 jours pour nous le retourner, et nous vous remboursons même les frais de port."],
  ["Avez-vous un magasin à Lyon ?", "Bonjour, nous n'avons pas de magasin physique : nous vendons uniquement en ligne."],
  ["Je n'ai pas reçu ma facture.", "Hello, I have just sent your invoice again to your e-mail address."],
];

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ACTIONS: Record<string, string> = {
  "support-client-fr": "zendesk.reply",
  "moderation-avis": "google.reply",
  "rapprochement-bancaire": "pennylane.update",
  "planification-livraisons": "calendar.create",
  "tri-candidatures": "ats.update",
};

async function main() {
  const agents = await admin<Summary[]>("/api/agents");
  const chosen = agents.filter((a) => a.id in ACTIONS || a.id === "remboursements").slice(0, 8);
  const clients = await Promise.all(
    chosen.map(async (a) => {
      const d = await admin<Detail>(`/api/agents/${a.id}`);
      return { id: a.id, name: d.name, lang: d.expected_language, hq: new AgentHQ({ url: URL_, key: d.api_key }) };
    }),
  );
  console.log(`Simulation de ${clients.length} agents sur ${URL_} (Ctrl+C pour arrêter)`);

  let tick = 0;
  let refundPending = false;
  for (;;) {
    tick++;
    const c = pick(clients);
    const cfg = await c.hq.config();
    if (cfg.paused) {
      if (tick % 20 === 0) console.log(`⏸  ${c.name} est en pause, il attend.`);
      await sleep(400);
      continue;
    }

    if (c.id === "remboursements") {
      // One refund at a time, and not too often: humans have other things to do.
      if (refundPending || Math.random() > 0.2) { await sleep(300); continue; }
      refundPending = true;
      const amount = pick([4500, 8900, 12000, 26000, 41000]);
      const who = pick(["Mme Bernard", "Café des Arts", "M. Nguyen", "Boulangerie Lemoine"]);
      c.hq
        .guard(
          { action: "stripe.refund", amount_cents: amount, target: who, summary: `Rembourser ${amount / 100} € à ${who}`, context: "Article reçu abîmé, photos jointes par le client." },
          async () => sleep(200),
          { cost_cents: 9, waitMs: 10 * 60_000 },
        )
        .then(() => console.log(`💶 ${c.name} : ${amount / 100} € remboursés à ${who}`))
        .catch((err) => console.log(`✋ ${c.name} : ${err instanceof ActionRefused ? err.reason : err.message}`))
        .finally(() => { refundPending = false; });
    } else {
      const cheap = cfg.model_tier === "economy";
      const qa = c.id === "support-client-fr" ? pick(SUPPORT_QA) : null;
      await c.hq.report({
        ...(qa ? { input: qa[0], output: qa[1] } : {}),
        kind: "task",
        action: ACTIONS[c.id],
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
  console.error("La simulation s'est arrêtée :", err.message);
  process.exit(1);
});
