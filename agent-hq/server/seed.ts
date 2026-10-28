/**
 * Demo workspace: 100 agents with 8 days of realistic history and live
 * incidents (duplicate e-mails, wrong language + cost spike, expired access,
 * judgement errors, a mistake reported by a colleague). The alert engine
 * then detects them like it would in real life. The content follows the
 * instance language: a US company in English, a French one in French.
 */
import { MAIN_WORKSPACE, run, tx, type DB } from "./db.ts";
import { evaluateAll } from "./engine.ts";
import { muteNotifications } from "./notify.ts";
import { lang, tr } from "./i18n.ts";
import { DAY, HOUR, MINUTE, logActivity, newApiKey, startOfMonth } from "./model.ts";

interface SeedAgent {
  id: string;
  name: string;
  mission: string;
  owner: [string, string];
  autonomy: 0 | 1 | 2;
  tasksPerDay: number;
  costCents: number;
  action: string;
  minutes: number;
  access: string[];
  language?: string;
  platform: string;
}

type Verdict = "ok" | "doubt" | "error";
type ReviewCase = [input: string, output: string, verdict: Verdict, summary: string, issues: Array<[string, string]>];
type Approval = [agent: string, action: string, title: string, context: string, reason: string, amountCents: number, agoMs: number];

/** Everything in the demo that is written in a human language. */
interface DemoContent {
  owners: Array<[string, string]>;
  named: (owners: Array<[string, string]>) => SeedAgent[];
  templates: Array<[name: string, mission: string, action: string, access: string[]]>;
  teams: string[];
  language: string;
  prompt: (name: string, mission: string) => string;
  firstVersion: string;
  ids: { reminders: string; support: string; leads: string; refunds: string; quotes: string };
  reminders: { v1: string; v2: string; v2note: string; recipient: (i: number) => string };
  /** The support agent drifts to this language (incident 2). */
  drift: string;
  refundPrompt: string;
  refundCases: ReviewCase[];
  refundOk: (order: number, amount: number) => ReviewCase;
  reviewer: string;
  supportAnswers: Array<[input: string, output: string, language: string]>;
  report: { author: string; description: string; journal: string };
  approvals: Approval[];
  decided: { title: string; context: string; reason: string; amountCents: number; by: string; journal: string };
  rules: { refund: string; email: string; budget: string; duplicates: string; quote: string; timezone: string };
  promptChange: { by: string; journal: string };
}

const EN: DemoContent = {
  owners: [
    ["Jessica Miller", "jessica.miller@example.com"],
    ["Marcus Johnson", "marcus.johnson@example.com"],
    ["Emily Chen", "emily.chen@example.com"],
    ["David Rodriguez", "david.rodriguez@example.com"],
    ["Sarah Thompson", "sarah.thompson@example.com"],
    ["Ryan Patel", "ryan.patel@example.com"],
    ["Olivia Brooks", "olivia.brooks@example.com"],
    ["Aisha Williams", "aisha.williams@example.com"],
  ],
  named: (o) => [
    { id: "invoice-reminders", name: "Invoice Reminders", mission: "Follows up with customers who are late on payment", owner: o[0], autonomy: 2, tasksPerDay: 300, costCents: 4, action: "email.send", minutes: 4, access: ["Gmail · send", "QuickBooks · read"], platform: "n8n" },
    { id: "customer-support", name: "Customer Support", mission: "Answers tier-1 support tickets", owner: o[1], autonomy: 1, tasksPerDay: 480, costCents: 3, action: "zendesk.reply", minutes: 6, access: ["Zendesk · reply", "Knowledge base"], language: "en", platform: "Claude Agent SDK" },
    { id: "lead-scoring", name: "Lead Scoring", mission: "Scores new leads in the CRM", owner: o[2], autonomy: 2, tasksPerDay: 160, costCents: 2, action: "hubspot.update", minutes: 3, access: ["HubSpot · edit", "LinkedIn · read"], platform: "Make" },
    { id: "refunds", name: "Refunds", mission: "Handles customer refund requests", owner: o[0], autonomy: 1, tasksPerDay: 45, costCents: 9, action: "stripe.refund", minutes: 8, access: ["Stripe · refund", "Zendesk · read"], platform: "Claude Agent SDK" },
    { id: "resume-screening", name: "Resume Screening", mission: "Shortlists incoming resumes", owner: o[4], autonomy: 0, tasksPerDay: 70, costCents: 6, action: "ats.update", minutes: 5, access: ["Greenhouse · read"], platform: "n8n" },
    { id: "bank-reconciliation", name: "Bank Reconciliation", mission: "Matches each payment to its invoice", owner: o[3], autonomy: 2, tasksPerDay: 210, costCents: 1, action: "quickbooks.update", minutes: 2, access: ["Mercury · read", "QuickBooks · edit"], platform: "Make" },
    { id: "market-watch", name: "Market Watch", mission: "Sums up the week's market news", owner: o[2], autonomy: 2, tasksPerDay: 6, costCents: 35, action: "notion.create", minutes: 45, access: ["Web · read", "Notion · write"], platform: "OpenAI Agents" },
    { id: "delivery-planning", name: "Delivery Planning", mission: "Plans the next day's delivery routes", owner: o[3], autonomy: 1, tasksPerDay: 120, costCents: 2, action: "calendar.create", minutes: 4, access: ["ShipStation", "Google Calendar"], platform: "n8n" },
    { id: "quote-writer", name: "Quote Writer", mission: "Drafts quotes from customer requests", owner: o[1], autonomy: 0, tasksPerDay: 30, costCents: 18, action: "quote.send", minutes: 25, access: ["HubSpot · read", "Google Docs"], platform: "Claude Agent SDK" },
    { id: "review-replies", name: "Review Replies", mission: "Replies to the store's Google reviews", owner: o[4], autonomy: 2, tasksPerDay: 90, costCents: 1, action: "google.reply", minutes: 3, access: ["Google Business · reply"], language: "en", platform: "Zapier" },
  ],
  templates: [
    ["Email Triage", "Sorts incoming emails by priority", "gmail.label", ["Gmail · read"]],
    ["FAQ Answers", "Answers common questions on the website", "chat.reply", ["Website chat · reply"]],
    ["Expense Reports", "Enters receipts into the books", "quickbooks.create", ["QuickBooks · create"]],
    ["Meeting Notes", "Sums up meetings and sends the action items", "notion.create", ["Zoom · read", "Notion · write"]],
    ["Product Listings", "Keeps product descriptions up to date", "shopify.update", ["Shopify · edit"]],
    ["Quote Follow-ups", "Follows up on unanswered quotes", "email.send", ["Gmail · send", "HubSpot · read"]],
    ["Scheduling", "Offers appointment slots to customers", "calendar.create", ["Google Calendar"]],
    ["Order Tracking", "Keeps customers posted on their deliveries", "email.send", ["ShipStation · read", "Gmail · send"]],
    ["Translation", "Translates marketing content", "docs.update", ["Google Docs"]],
    ["Weekly Report", "Prepares the Monday activity report", "slack.post", ["Slack · post", "QuickBooks · read"]],
  ],
  teams: ["New York", "Chicago", "Austin", "Denver", "Miami", "Seattle", "Online", "B2B", "Wholesale"],
  language: "en",
  prompt: (name, mission) => `You are the “${name}” agent. Mission: ${mission}. Stay polite and concise, and answer in English.`,
  firstVersion: "First version",
  ids: { reminders: "invoice-reminders", support: "customer-support", leads: "lead-scoring", refunds: "refunds", quotes: "quote-writer" },
  reminders: {
    v1: "You are the “Invoice Reminders” agent. Before each reminder, check in QuickBooks that the customer has not already been reminded this week. Follow up on invoices more than 30 days overdue. Be courteous.",
    v2: "You are the “Invoice Reminders” agent. Follow up with every customer whose invoice is more than 30 days overdue. Be firm but courteous.",
    v2note: "Firmer tone requested by management",
    recipient: (i) => `customer-${1200 + i}@example.com`,
  },
  drift: "es",
  refundPrompt:
    "You handle refund requests. Refund the exact order amount if the item arrived damaged AND a photo is attached, within 30 days of delivery. A wrong color or taste is not damage: offer an exchange. Above $200, ask for approval. Never give delivery information you don't have.",
  refundCases: [
    ["Order #8790 · $98.00 · ceramic bowl arrived broken, photo attached.", "Refund of $89.00 issued to the customer's card.", "error",
      "It refunded $89 although the order was $98.", [["incorrect", "The refunded amount does not match the order amount ($98)."]]],
    ["Order #8771 · $45.00 · delivered on September 2. The customer asks for a refund on October 20, with no photo.", "Refund of $45.00 issued. Have a great day!", "error",
      "It refunded after the deadline (48 days) and without a photo, against its instructions.", [["hors_consignes", "The 30-day window has passed and no photo was provided."]]],
    ["Order #8802 · $64.00 · the customer says the package never arrived.", "I can confirm the carrier delivered your package on October 18 at 10:12 am, signed for by Mr. Davis.", "error",
      "It made up a proof of delivery (time and signer) that appears nowhere.", [["invente", "No tracking information was available: the time and the signer's name are made up."]]],
    ["Order #8810 · $120.00 · the customer feels the color doesn't match the photo on the website.", "Refund of $120.00 issued.", "doubt",
      "A different color is not damage: it should have offered an exchange.", [["hors_consignes", "The instructions call for an exchange when the color is wrong."]]],
  ],
  refundOk: (order, amount) => [`Order #${order} · $${amount}.00 · item arrived broken, photo attached.`, `Refund of $${amount}.00 issued. We're sorry for the trouble.`, "ok",
    "Exact amount, photo attached, within the window.", []],
  reviewer: "demo",
  supportAnswers: [
    ["Hi, my order 4521 was supposed to arrive Monday and I still have nothing.", "Hi, I'm sorry about the delay. Your package 4521 is in transit and should arrive tomorrow before 1 pm. Let me know if you need anything else.", "en"],
    ["Do you ship to Canada?", "Hi! Yes, we ship to Canada in 3 to 5 business days. Shipping is free on orders over $60.", "en"],
    ["I can't log into my account.", "¡Hola! Puede restablecer su contraseña con el enlace «¿Olvidó su contraseña?» en la página de inicio de sesión.", "es"],
  ],
  report: {
    author: "Marcus Johnson",
    description: "The quote sent to Riverside Auto Repair left out sales tax entirely.",
    journal: "Mistake reported on Quote Writer: sales tax left out of a quote.",
  },
  approvals: [
    ["refunds", "stripe.refund", "Refund $340 to Harbor Grill", "Order #8812 arrived damaged. The customer sent two photos; the carrier confirms the impact.",
      "the amount is over your $200 threshold.", 34000, 2 * HOUR],
    ["quote-writer", "quote.send", "Send a $12,400 quote to Moreau Design Studio", "Request received Friday for 40 seats. 8% discount applied per your price grid.",
      "this agent is at level 0 (in training): every action is approved.", 1240000, 5 * HOUR],
    ["customer-support", "voucher.create", "Give a $30 voucher to an unhappy customer", "Third late delivery for this customer since September. They are threatening to cancel.",
      "goodwill gestures are not part of its usual access.", 3000, 40 * MINUTE],
  ],
  decided: {
    title: "Refund $260 to Mrs. Garcia", context: "Double charge confirmed.", reason: "the amount is over your $200 threshold.", amountCents: 26000,
    by: "Jessica Miller", journal: "Approved: Refund $260 to Mrs. Garcia",
  },
  rules: { refund: "refund", email: "customer email", budget: "budget", duplicates: "duplicates", quote: "quote", timezone: "America/New_York" },
  promptChange: { by: "Management", journal: "New instructions for Invoice Reminders (version 2)." },
};

const FR: DemoContent = {
  owners: [
    ["Julie Martin", "julie.martin@exemple.fr"],
    ["Karim Benali", "karim.benali@exemple.fr"],
    ["Sophie Laurent", "sophie.laurent@exemple.fr"],
    ["Thomas Petit", "thomas.petit@exemple.fr"],
    ["Inès Roux", "ines.roux@exemple.fr"],
    ["Hugo Lefèvre", "hugo.lefevre@exemple.fr"],
    ["Camille Girard", "camille.girard@exemple.fr"],
    ["Nadia Haddad", "nadia.haddad@exemple.fr"],
  ],
  named: (o) => [
    { id: "relance-factures", name: "Relance Factures", mission: "Relance les clients en retard de paiement", owner: o[0], autonomy: 2, tasksPerDay: 300, costCents: 4, action: "email.send", minutes: 4, access: ["Gmail · envoi", "Pennylane · lecture"], platform: "n8n" },
    { id: "support-client-fr", name: "Support Client FR", mission: "Répond aux tickets de niveau 1", owner: o[1], autonomy: 1, tasksPerDay: 480, costCents: 3, action: "zendesk.reply", minutes: 6, access: ["Zendesk · réponse", "Base de connaissances"], language: "fr", platform: "Claude Agent SDK" },
    { id: "qualification-leads", name: "Qualification Leads", mission: "Note les nouveaux prospects dans le CRM", owner: o[2], autonomy: 2, tasksPerDay: 160, costCents: 2, action: "hubspot.update", minutes: 3, access: ["HubSpot · modification", "LinkedIn · lecture"], platform: "Make" },
    { id: "remboursements", name: "Remboursements", mission: "Traite les demandes de remboursement des clients", owner: o[0], autonomy: 1, tasksPerDay: 45, costCents: 9, action: "stripe.refund", minutes: 8, access: ["Stripe · remboursement", "Zendesk · lecture"], platform: "Claude Agent SDK" },
    { id: "tri-candidatures", name: "Tri des candidatures", mission: "Présélectionne les CV reçus", owner: o[4], autonomy: 0, tasksPerDay: 70, costCents: 6, action: "ats.update", minutes: 5, access: ["Welcome to the Jungle · lecture"], platform: "n8n" },
    { id: "rapprochement-bancaire", name: "Rapprochement bancaire", mission: "Associe chaque paiement à sa facture", owner: o[3], autonomy: 2, tasksPerDay: 210, costCents: 1, action: "pennylane.update", minutes: 2, access: ["Qonto · lecture", "Pennylane · modification"], platform: "Make" },
    { id: "veille-concurrentielle", name: "Veille concurrentielle", mission: "Résume chaque semaine les annonces du marché", owner: o[2], autonomy: 2, tasksPerDay: 6, costCents: 35, action: "notion.create", minutes: 45, access: ["Web · lecture", "Notion · écriture"], platform: "OpenAI Agents" },
    { id: "planification-livraisons", name: "Planification livraisons", mission: "Organise les tournées du lendemain", owner: o[3], autonomy: 1, tasksPerDay: 120, costCents: 2, action: "calendar.create", minutes: 4, access: ["Shippingbo", "Google Agenda"], platform: "n8n" },
    { id: "redaction-devis", name: "Rédaction devis", mission: "Prépare les devis à partir des demandes clients", owner: o[1], autonomy: 0, tasksPerDay: 30, costCents: 18, action: "quote.send", minutes: 25, access: ["HubSpot · lecture", "Google Docs"], platform: "Claude Agent SDK" },
    { id: "moderation-avis", name: "Modération avis", mission: "Répond aux avis Google de la boutique", owner: o[4], autonomy: 2, tasksPerDay: 90, costCents: 1, action: "google.reply", minutes: 3, access: ["Google Business · réponse"], language: "fr", platform: "Zapier" },
  ],
  templates: [
    ["Tri des e-mails", "Classe les e-mails entrants par priorité", "gmail.label", ["Gmail · lecture"]],
    ["Réponses FAQ", "Répond aux questions fréquentes du site", "chat.reply", ["Chat du site · réponse"]],
    ["Notes de frais", "Saisit les justificatifs dans la comptabilité", "pennylane.create", ["Pennylane · création"]],
    ["Comptes rendus", "Résume les réunions et envoie les actions", "notion.create", ["Google Meet · lecture", "Notion · écriture"]],
    ["Fiches produits", "Met à jour les descriptions produits", "shopify.update", ["Shopify · modification"]],
    ["Relance devis", "Relance les devis restés sans réponse", "email.send", ["Gmail · envoi", "HubSpot · lecture"]],
    ["Prise de rendez-vous", "Propose des créneaux aux clients", "calendar.create", ["Google Agenda"]],
    ["Suivi colis", "Informe les clients de l'avancée de leur colis", "email.send", ["Shippingbo · lecture", "Gmail · envoi"]],
    ["Traduction", "Traduit les contenus marketing", "docs.update", ["Google Docs"]],
    ["Rapport hebdo", "Prépare le point d'activité du lundi", "slack.post", ["Slack · publication", "Pennylane · lecture"]],
  ],
  teams: ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Nantes", "Web", "B2B", "Export"],
  language: "fr",
  prompt: (name, mission) => `Tu es l'agent « ${name} ». Mission : ${mission}. Reste poli, concis et réponds en français.`,
  firstVersion: "Version initiale",
  ids: { reminders: "relance-factures", support: "support-client-fr", leads: "qualification-leads", refunds: "remboursements", quotes: "redaction-devis" },
  reminders: {
    v1: "Tu es l'agent « Relance Factures ». Avant chaque relance, vérifie dans Pennylane que le client n'a pas déjà été relancé cette semaine. Relance les factures de plus de 30 jours de retard. Sois courtois.",
    v2: "Tu es l'agent « Relance Factures ». Relance chaque client dont la facture a plus de 30 jours de retard. Sois ferme mais courtois.",
    v2note: "Ton plus ferme demandé par la direction",
    recipient: (i) => `client-${1200 + i}@exemple.fr`,
  },
  drift: "en",
  refundPrompt:
    "Tu traites les demandes de remboursement. Rembourse le montant exact de la commande si l'article est arrivé endommagé ET qu'une photo est jointe, dans les 30 jours suivant la livraison. Une erreur de couleur ou de goût n'est pas un dommage : propose un échange. Au-delà de 200 €, demande une validation. Ne donne jamais d'information de livraison que tu n'as pas.",
  refundCases: [
    ["Commande n° 8790 · 98,00 € · bol en céramique cassé, photo jointe.", "Remboursement de 89,00 € effectué sur la carte du client.", "error",
      "Il a remboursé 89 € alors que la commande faisait 98 €.", [["incorrect", "Le montant remboursé ne correspond pas au montant de la commande (98 €)."]]],
    ["Commande n° 8771 · 45,00 € · livrée le 2 septembre. Le client demande un remboursement le 20 octobre, sans photo.", "Remboursement de 45,00 € effectué. Bonne journée !", "error",
      "Il a remboursé hors délai (48 jours) et sans photo, contrairement à ses consignes.", [["hors_consignes", "Le délai de 30 jours est dépassé et aucune photo n'a été fournie."]]],
    ["Commande n° 8802 · 64,00 € · le client dit n'avoir jamais reçu son colis.", "Je vous confirme que le transporteur a livré votre colis le 18 octobre à 10 h 12, signé par M. Durand.", "error",
      "Il invente une preuve de livraison (heure et signataire) qui n'apparaît nulle part.", [["invente", "Aucune information de suivi n'était disponible : l'heure et le nom du signataire sont inventés."]]],
    ["Commande n° 8810 · 120,00 € · le client trouve que la couleur ne correspond pas à la photo du site.", "Remboursement de 120,00 € effectué.", "doubt",
      "Une couleur différente n'est pas un dommage : il aurait dû proposer un échange.", [["hors_consignes", "Les consignes prévoient un échange pour une erreur de couleur."]]],
  ],
  refundOk: (order, amount) => [`Commande n° ${order} · ${amount},00 € · article arrivé cassé, photo jointe.`, `Remboursement de ${amount},00 € effectué. Toutes nos excuses pour ce désagrément.`, "ok",
    "Montant exact, photo présente, dans les délais.", []],
  reviewer: "démo",
  supportAnswers: [
    ["Bonjour, ma commande 4521 devait arriver lundi et je n'ai toujours rien.", "Bonjour, je suis désolé pour ce retard. Votre colis 4521 est en transit et devrait arriver demain avant 13 h. Je reste disponible si besoin.", "fr"],
    ["Est-ce que vous livrez en Belgique ?", "Bonjour ! Oui, nous livrons en Belgique en 3 à 5 jours ouvrés. Les frais de port sont offerts dès 60 € d'achat.", "fr"],
    ["Je n'arrive pas à me connecter à mon compte.", "Hello! You can reset your password using the 'Forgot password' link on the login page.", "en"],
  ],
  report: {
    author: "Karim Benali",
    description: "Le devis envoyé à Garage Lemaire était calculé avec une TVA à 10 % au lieu de 20 %.",
    journal: "Erreur signalée sur Rédaction devis : TVA à 10 % au lieu de 20 %.",
  },
  approvals: [
    ["remboursements", "stripe.refund", "Rembourser 340 € à Brasserie du Port", "Commande n° 8812 livrée endommagée. Le client a envoyé deux photos ; le transporteur confirme le choc.",
      "le montant dépasse votre seuil de 200 €.", 34000, 2 * HOUR],
    ["redaction-devis", "quote.send", "Envoyer un devis de 12 400 € à Atelier Moreau", "Demande reçue vendredi pour 40 postes. Remise de 8 % appliquée selon votre grille tarifaire.",
      "cet agent est au niveau 0 (en formation) : chaque action est validée.", 1240000, 5 * HOUR],
    ["support-client-fr", "voucher.create", "Offrir un bon de 30 € à un client mécontent", "Troisième retard de livraison pour ce client depuis septembre. Il menace de résilier.",
      "les gestes commerciaux ne font pas partie de ses accès habituels.", 3000, 40 * MINUTE],
  ],
  decided: {
    title: "Rembourser 260 € à Mme Garnier", context: "Double prélèvement constaté.", reason: "le montant dépasse votre seuil de 200 €.", amountCents: 26000,
    by: "Julie Martin", journal: "Approuvé : Rembourser 260 € à Mme Garnier",
  },
  rules: { refund: "remboursement", email: "e-mail client", budget: "budget", duplicates: "doublons", quote: "devis", timezone: "Europe/Paris" },
  promptChange: { by: "Direction", journal: "Nouvelles consignes pour Relance Factures (version 2)." },
};

const PLATFORMS = ["n8n", "Make", "Zapier", "Claude Agent SDK", "OpenAI Agents"];

const content = () => (lang() === "fr" ? FR : EN);

/** Small deterministic PRNG so the demo looks the same every time. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Share of a day's work done in each hour (busier during office hours). */
const HOUR_WEIGHT = Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 19 ? 3 : h >= 6 && h < 22 ? 1.2 : 0.3));
const WEIGHT_SUM = HOUR_WEIGHT.reduce((a, b) => a + b, 0);

export function buildAgents(c: DemoContent = content()): SeedAgent[] {
  const rand = rng(7);
  const generated: SeedAgent[] = [];
  c.templates.forEach(([name, mission, action, access], ti) => {
    c.teams.forEach((team, i) => {
      generated.push({
        id: `${name}-${team}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: `${name} · ${team}`,
        mission,
        owner: c.owners[(ti + i) % c.owners.length],
        autonomy: (rand() < 0.15 ? 0 : rand() < 0.5 ? 1 : 2) as 0 | 1 | 2,
        tasksPerDay: Math.round(15 + rand() * 35),
        costCents: Math.round((0.5 + rand() * 2.5) * 10) / 10,
        action,
        minutes: Math.round(2 + rand() * 8),
        access,
        platform: PLATFORMS[(ti + i) % PLATFORMS.length],
      });
    });
  });
  return [...c.named(c.owners), ...generated];
}

/** The demo's alerts are not news: nobody's chat channel is pinged for them. */
export function seed(db: DB, now = Date.now()) {
  muteNotifications(true);
  try {
    fill(db, now);
  } finally {
    muteNotifications(false);
  }
}

function fill(db: DB, now: number) {
  const c = content();
  const { ids } = c;
  const rand = rng(42);
  const agents = buildAgents(c);
  const insertEvent = db.prepare(
    `INSERT INTO events (agent_id, ts, kind, action, target, success, cost_cents, duration_ms, language, error_code, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const event = (agentId: string, ts: number, kind: string, action: string | null, target: string | null, ok: boolean, cost: number, language: string | null = null, code: string | null = null, msg: string | null = null) =>
    insertEvent.run(agentId, Math.round(ts), kind, action, target, ok ? 1 : 0, cost, Math.round(800 + rand() * 6000), language, code, msg);

  tx(db, () => {
    // Only the first workspace holds the demo: client workspaces are never touched.
    const demoAgents = "SELECT id FROM agents WHERE workspace_id = ?";
    for (const t of ["reviews", "reports", "events", "alerts", "approvals", "prompt_versions", "hooks"]) run(db, `DELETE FROM ${t} WHERE agent_id IN (${demoAgents})`, MAIN_WORKSPACE);
    for (const t of ["activity", "rules", "agents"]) run(db, `DELETE FROM ${t} WHERE workspace_id = ?`, MAIN_WORKSPACE);
    run(db, "UPDATE workspaces SET name = ? WHERE id = ?", tr("Demo workspace", "Espace de démonstration"), MAIN_WORKSPACE);

    for (const a of agents) {
      const daily = (a.tasksPerDay * a.costCents) / 100;
      const budget = Math.max(20, Math.ceil((daily * 31 * 1.4) / 10) * 10) * 100;
      run(
        db,
        `INSERT INTO agents (id, name, mission, owner_name, owner_email, platform, autonomy, budget_cents, expected_language, access, minutes_per_task, api_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id, a.name, a.mission, a.owner[0], a.owner[1], a.platform, a.autonomy, budget, a.language ?? null,
        JSON.stringify(a.access), a.minutes, newApiKey(), now - 40 * DAY,
      );
      run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, 1, ?, ?, 1, ?)",
        a.id, c.prompt(a.name, a.mission), c.firstVersion, now - 40 * DAY);

      // Spend from the start of the month up to 8 days ago, one roll-up per day.
      for (let t = startOfMonth(now) + 12 * HOUR; t < now - 8 * DAY; t += DAY) {
        event(a.id, t, "action", "usage.rollup", null, true, a.tasksPerDay * a.costCents * (0.85 + rand() * 0.3));
      }

      // Last 8 days, hour by hour.
      const start = now - 8 * DAY;
      for (let t = start; t < now; t += HOUR) {
        const hour = new Date(t).getHours();
        const expected = (a.tasksPerDay * HOUR_WEIGHT[hour]) / WEIGHT_SUM;
        const n = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const ts = t + rand() * HOUR;
          if (ts >= now) continue;
          const ok = rand() > 0.025;
          event(a.id, ts, "task", a.action, `${a.id}-${Math.floor(ts)}-${k}`, ok, a.costCents * (0.7 + rand() * 0.6), a.language ?? null,
            ok ? null : "timeout", ok ? null : "Request timed out after 30000ms");
        }
      }
    }

    // Incident 1 — duplicate reminders after a prompt change 15 hours ago.
    run(db, "UPDATE prompt_versions SET active = 0 WHERE agent_id = ?", ids.reminders);
    run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, 2, ?, ?, 1, ?)",
      ids.reminders, c.reminders.v2, c.reminders.v2note, now - 15 * HOUR);
    run(db, "UPDATE prompt_versions SET content = ? WHERE agent_id = ? AND version = 1", c.reminders.v1, ids.reminders);
    for (let i = 0; i < 40; i++) {
      const target = c.reminders.recipient(i);
      event(ids.reminders, now - 48 * MINUTE + i * 30_000, "action", "email.send", target, true, 4);
      event(ids.reminders, now - 40 * MINUTE + i * 30_000, "action", "email.send", target, true, 4);
    }

    // Incident 2 — the support agent switched language, and costs more per ticket.
    for (let i = 0; i < 110; i++) {
      event(ids.support, now - 3 * HOUR + i * 95_000, "task", "zendesk.reply", `ticket-${88000 + i}`, true, 7, c.drift);
    }
    for (let i = 0; i < 250; i++) {
      event(ids.support, now - DAY + rand() * (DAY - 6 * HOUR), "task", "zendesk.reply", `ticket-${80000 + i}`, true, 6 + rand() * 3, c.language);
    }

    // Incident 3 — HubSpot access expired.
    for (let i = 0; i < 14; i++) {
      event(ids.leads, now - 26 * MINUTE + i * 110_000, "task", "hubspot.update", `lead-${5400 + i}`, false, 0.5, null, "401", "Unauthorized: OAuth access token expired");
    }

    // Incident 4 — judgement errors that only a reader can see. The AI review
    // (here pre-filled, marked "demo") caught them on the refunds agent.
    run(db, "UPDATE prompt_versions SET content = ? WHERE agent_id = ?", c.refundPrompt, ids.refunds);
    const refundCases = [...c.refundCases];
    for (let i = 0; i < 8; i++) refundCases.push(c.refundOk(8820 + i, [32, 54, 18, 76, 41, 23, 67, 95][i]));
    refundCases.forEach(([input, output, verdict, summary, issues], i) => {
      const ts = now - (19 - i * 1.5) * HOUR;
      const res = run(db,
        "INSERT INTO events (agent_id, ts, kind, action, target, success, cost_cents, input, output, review_state) VALUES (?, ?, 'task', 'stripe.refund', ?, 1, 9, ?, ?, 'done')",
        ids.refunds, Math.round(ts), `refund-${i}`, input, output);
      run(db, "INSERT INTO reviews (event_id, agent_id, verdict, score, summary, issues, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        Number(res.lastInsertRowid), ids.refunds, verdict, verdict === "ok" ? 95 : verdict === "doubt" ? 55 : 15, summary,
        JSON.stringify(issues.map(([type, detail]) => ({ type, detail }))), c.reviewer, Math.round(ts + MINUTE));
    });

    // Recent support answers, readable in the agent's file (not reviewed yet).
    c.supportAnswers.forEach(([input, output, language], i) => {
      run(db,
        "INSERT INTO events (agent_id, ts, kind, action, target, success, cost_cents, language, input, output) VALUES (?, ?, 'task', 'zendesk.reply', ?, 1, 7, ?, ?, ?)",
        ids.support, now - (40 - i * 12) * MINUTE, `ticket-9${i}`, language, input, output);
    });

    // An error spotted by a colleague.
    run(db, "INSERT INTO reports (agent_id, author, description, created_at) VALUES (?, ?, ?, ?)", ids.quotes, c.report.author, c.report.description, now - 3 * HOUR);
    logActivity(db, c.report.author, c.report.journal, ids.quotes, now - 3 * HOUR);

    // Pending decisions.
    for (const [agent, action, title, context, reason, amount, ago] of c.approvals) {
      run(db, "INSERT INTO approvals (agent_id, action, title, context, reason, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        agent, action, title, context, reason, amount, now - ago);
    }
    const d = c.decided;
    run(db, "INSERT INTO approvals (agent_id, action, title, context, reason, amount_cents, status, created_at, decided_at, decided_by) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)",
      ids.refunds, "stripe.refund", d.title, d.context, d.reason, d.amountCents, now - 26 * HOUR, now - 25 * HOUR, d.by);

    // Guardrails. `label` is the subject used to build each rule's sentence.
    let order = 0;
    const rule = (id: string, kind: string, label: string, params: object, enabled: boolean, count: number) =>
      run(db, "INSERT INTO rules (id, kind, label, params, enabled, trigger_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, kind, label, JSON.stringify(params), enabled ? 1 : 0, count, now - 30 * DAY + order++);
    const r = c.rules;
    rule("refunds", "approval_amount", r.refund, { action_prefix: "stripe.refund", max_cents: 20000 }, true, 3);
    rule("quiet-hours", "quiet_hours", r.email, { action_prefix: "email.send", start_hour: 22, end_hour: 7, timezone: r.timezone }, true, 12);
    rule("monthly-budget", "global_budget", r.budget, { max_cents: 500000 }, true, 0);
    rule("repeat-pause", "repeat_pause", r.duplicates, { count: 10, window_min: 60 }, false, 0);
    rule("quotes", "approval_amount", r.quote, { action_prefix: "quote.send", max_cents: 500000 }, true, 1);

    logActivity(db, d.by, d.journal, ids.refunds, now - 25 * HOUR);
    logActivity(db, c.promptChange.by, c.promptChange.journal, ids.reminders, now - 15 * HOUR);

    evaluateAll(db, now);
  });
}
