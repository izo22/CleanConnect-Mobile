/**
 * Demo workspace: 100 agents with 8 days of realistic history and three
 * live incidents (duplicate e-mails, wrong language + cost spike, expired
 * access). The alert engine then detects them like it would in real life.
 */
import { run, tx, type DB } from "./db.ts";
import { evaluateAll } from "./engine.ts";
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

const OWNERS: Array<[string, string]> = [
  ["Julie Martin", "julie.martin@exemple.fr"],
  ["Karim Benali", "karim.benali@exemple.fr"],
  ["Sophie Laurent", "sophie.laurent@exemple.fr"],
  ["Thomas Petit", "thomas.petit@exemple.fr"],
  ["Inès Roux", "ines.roux@exemple.fr"],
  ["Hugo Lefèvre", "hugo.lefevre@exemple.fr"],
  ["Camille Girard", "camille.girard@exemple.fr"],
  ["Nadia Haddad", "nadia.haddad@exemple.fr"],
];

const NAMED: SeedAgent[] = [
  { id: "relance-factures", name: "Relance Factures", mission: "Relance les clients en retard de paiement", owner: OWNERS[0], autonomy: 2, tasksPerDay: 300, costCents: 4, action: "email.send", minutes: 4, access: ["Gmail · envoi", "Pennylane · lecture"], platform: "n8n" },
  { id: "support-client-fr", name: "Support Client FR", mission: "Répond aux tickets de niveau 1", owner: OWNERS[1], autonomy: 1, tasksPerDay: 480, costCents: 3, action: "zendesk.reply", minutes: 6, access: ["Zendesk · réponse", "Base de connaissances"], language: "fr", platform: "Claude Agent SDK" },
  { id: "qualification-leads", name: "Qualification Leads", mission: "Note les nouveaux prospects dans le CRM", owner: OWNERS[2], autonomy: 2, tasksPerDay: 160, costCents: 2, action: "hubspot.update", minutes: 3, access: ["HubSpot · modification", "LinkedIn · lecture"], platform: "Make" },
  { id: "remboursements", name: "Remboursements", mission: "Traite les demandes de remboursement des clients", owner: OWNERS[0], autonomy: 1, tasksPerDay: 45, costCents: 9, action: "stripe.refund", minutes: 8, access: ["Stripe · remboursement", "Zendesk · lecture"], platform: "Claude Agent SDK" },
  { id: "tri-candidatures", name: "Tri des candidatures", mission: "Présélectionne les CV reçus", owner: OWNERS[4], autonomy: 0, tasksPerDay: 70, costCents: 6, action: "ats.update", minutes: 5, access: ["Welcome to the Jungle · lecture"], platform: "n8n" },
  { id: "rapprochement-bancaire", name: "Rapprochement bancaire", mission: "Associe chaque paiement à sa facture", owner: OWNERS[3], autonomy: 2, tasksPerDay: 210, costCents: 1, action: "pennylane.update", minutes: 2, access: ["Qonto · lecture", "Pennylane · modification"], platform: "Make" },
  { id: "veille-concurrentielle", name: "Veille concurrentielle", mission: "Résume chaque semaine les annonces du marché", owner: OWNERS[2], autonomy: 2, tasksPerDay: 6, costCents: 35, action: "notion.create", minutes: 45, access: ["Web · lecture", "Notion · écriture"], platform: "OpenAI Agents" },
  { id: "planification-livraisons", name: "Planification livraisons", mission: "Organise les tournées du lendemain", owner: OWNERS[3], autonomy: 1, tasksPerDay: 120, costCents: 2, action: "calendar.create", minutes: 4, access: ["Shippingbo", "Google Agenda"], platform: "n8n" },
  { id: "redaction-devis", name: "Rédaction devis", mission: "Prépare les devis à partir des demandes clients", owner: OWNERS[1], autonomy: 0, tasksPerDay: 30, costCents: 18, action: "quote.send", minutes: 25, access: ["HubSpot · lecture", "Google Docs"], platform: "Claude Agent SDK" },
  { id: "moderation-avis", name: "Modération avis", mission: "Répond aux avis Google de la boutique", owner: OWNERS[4], autonomy: 2, tasksPerDay: 90, costCents: 1, action: "google.reply", minutes: 3, access: ["Google Business · réponse"], language: "fr", platform: "Zapier" },
];

const TEMPLATES: Array<[string, string, string, string[]]> = [
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
];
const TEAMS = ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Nantes", "Web", "B2B", "Export"];
const PLATFORMS = ["n8n", "Make", "Zapier", "Claude Agent SDK", "OpenAI Agents"];

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

export function buildAgents(): SeedAgent[] {
  const rand = rng(7);
  const generated: SeedAgent[] = [];
  TEMPLATES.forEach(([name, mission, action, access], ti) => {
    TEAMS.forEach((team, i) => {
      generated.push({
        id: `${name}-${team}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: `${name} · ${team}`,
        mission,
        owner: OWNERS[(ti + i) % OWNERS.length],
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
  return [...NAMED, ...generated];
}

export function seed(db: DB, now = Date.now()) {
  const rand = rng(42);
  const agents = buildAgents();
  const insertEvent = db.prepare(
    `INSERT INTO events (agent_id, ts, kind, action, target, success, cost_cents, duration_ms, language, error_code, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const event = (agentId: string, ts: number, kind: string, action: string | null, target: string | null, ok: boolean, cost: number, language: string | null = null, code: string | null = null, msg: string | null = null) =>
    insertEvent.run(agentId, Math.round(ts), kind, action, target, ok ? 1 : 0, cost, Math.round(800 + rand() * 6000), language, code, msg);

  tx(db, () => {
    for (const t of ["events", "alerts", "approvals", "prompt_versions", "activity", "rules", "agents"]) db.exec(`DELETE FROM ${t}`);

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
        a.id, `Tu es l'agent « ${a.name} ». Mission : ${a.mission}. Reste poli, concis et réponds en français.`, "Version initiale", now - 40 * DAY);

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
    run(db, "UPDATE prompt_versions SET active = 0 WHERE agent_id = 'relance-factures'");
    run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, 2, ?, ?, 1, ?)",
      "relance-factures",
      "Tu es l'agent « Relance Factures ». Relance chaque client dont la facture a plus de 30 jours de retard. Sois ferme mais courtois.",
      "Ton plus ferme demandé par la direction", now - 15 * HOUR);
    run(db, "UPDATE prompt_versions SET content = ? WHERE agent_id = 'relance-factures' AND version = 1",
      "Tu es l'agent « Relance Factures ». Avant chaque relance, vérifie dans Pennylane que le client n'a pas déjà été relancé cette semaine. Relance les factures de plus de 30 jours de retard. Sois courtois.");
    for (let i = 0; i < 40; i++) {
      const target = `client-${1200 + i}@exemple.fr`;
      event("relance-factures", now - 48 * MINUTE + i * 30_000, "action", "email.send", target, true, 4);
      event("relance-factures", now - 40 * MINUTE + i * 30_000, "action", "email.send", target, true, 4);
    }

    // Incident 2 — the support agent switched to English, and costs more per ticket.
    for (let i = 0; i < 110; i++) {
      event("support-client-fr", now - 3 * HOUR + i * 95_000, "task", "zendesk.reply", `ticket-${88000 + i}`, true, 7, "en");
    }
    for (let i = 0; i < 250; i++) {
      event("support-client-fr", now - DAY + rand() * (DAY - 6 * HOUR), "task", "zendesk.reply", `ticket-${80000 + i}`, true, 6 + rand() * 3, "fr");
    }

    // Incident 3 — HubSpot access expired.
    for (let i = 0; i < 14; i++) {
      event("qualification-leads", now - 26 * MINUTE + i * 110_000, "task", "hubspot.update", `lead-${5400 + i}`, false, 0.5, null, "401", "Unauthorized: OAuth access token expired");
    }

    // Pending decisions.
    const approval = (agent: string, action: string, title: string, context: string, reason: string, amount: number | null, ago: number) =>
      run(db, "INSERT INTO approvals (agent_id, action, title, context, reason, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        agent, action, title, context, reason, amount, now - ago);
    approval("remboursements", "stripe.refund", "Rembourser 340 € à Brasserie du Port",
      "Commande n° 8812 livrée endommagée. Le client a envoyé deux photos ; le transporteur confirme le choc.",
      "le montant dépasse votre seuil de 200 €.", 34000, 2 * HOUR);
    approval("redaction-devis", "quote.send", "Envoyer un devis de 12 400 € à Atelier Moreau",
      "Demande reçue vendredi pour 40 postes. Remise de 8 % appliquée selon votre grille tarifaire.",
      "cet agent est au niveau 0 (en formation) : chaque action est validée.", 1240000, 5 * HOUR);
    approval("support-client-fr", "voucher.create", "Offrir un bon de 30 € à un client mécontent",
      "Troisième retard de livraison pour ce client depuis septembre. Il menace de résilier.",
      "les gestes commerciaux ne font pas partie de ses accès habituels.", 3000, 40 * MINUTE);
    run(db, "INSERT INTO approvals (agent_id, action, title, context, reason, amount_cents, status, created_at, decided_at, decided_by) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)",
      "remboursements", "stripe.refund", "Rembourser 260 € à Mme Garnier", "Double prélèvement constaté.", "le montant dépasse votre seuil de 200 €.", 26000, now - 26 * HOUR, now - 25 * HOUR, "Julie Martin");

    // Guardrails. `label` is the subject used to build each rule's sentence.
    let order = 0;
    const rule = (id: string, kind: string, label: string, params: object, enabled: boolean, count: number) =>
      run(db, "INSERT INTO rules (id, kind, label, params, enabled, trigger_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, kind, label, JSON.stringify(params), enabled ? 1 : 0, count, now - 30 * DAY + order++);
    rule("refunds", "approval_amount", "remboursement", { action_prefix: "stripe.refund", max_cents: 20000 }, true, 3);
    rule("quiet-hours", "quiet_hours", "e-mail client", { action_prefix: "email.send", start_hour: 22, end_hour: 7, timezone: "Europe/Paris" }, true, 12);
    rule("monthly-budget", "global_budget", "budget", { max_cents: 500000 }, true, 0);
    rule("repeat-pause", "repeat_pause", "doublons", { count: 10, window_min: 60 }, false, 0);
    rule("quotes", "approval_amount", "devis", { action_prefix: "quote.send", max_cents: 500000 }, true, 1);

    logActivity(db, "Julie Martin", "Approuvé : Rembourser 260 € à Mme Garnier", "remboursements", now - 25 * HOUR);
    logActivity(db, "Direction", "Nouvelles consignes pour Relance Factures (version 2).", "relance-factures", now - 15 * HOUR);

    evaluateAll(db, now);
  });
}
