import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app.ts";
import { MAIN_WORKSPACE, get, openDb } from "./db.ts";
import { ensureMainRules, purgeExpiredSessions } from "./auth.ts";
import { evaluateAll } from "./engine.ts";
import { tr } from "./i18n.ts";
import { dailyMaintenance } from "./maintenance.ts";
import { HOUR, notifyChange } from "./model.ts";
import { syncAll } from "./n8n.ts";
import { startReviewer } from "./reviewer.ts";
import { seed } from "./seed.ts";
import { PRODUCT_NAME } from "./brand.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
const env = (key: string, fallback: string) => process.env[key] ?? fallback;

const dbPath = env("DATABASE_PATH", join(root, "data", "agent-hq.db"));
const port = Number(env("PORT", "8787"));
const host = env("HOST", "0.0.0.0");
const adminToken = process.env.ADMIN_TOKEN;

// Online, the dashboard must never be open to anyone who finds the address.
if (production && (!adminToken || adminToken.length < 16) && process.env.ALLOW_NO_AUTH !== "true") {
  console.error(tr(
    "ADMIN_TOKEN missing or too short (16 characters minimum). Generate one with: openssl rand -hex 24",
    "ADMIN_TOKEN manquant ou trop court (16 caractères minimum). Générez-en un avec : openssl rand -hex 24",
  ));
  process.exit(1);
}

const db = openDb(dbPath);
// The 100-agent demo is for local trials; a production instance starts empty unless asked.
const seedDemo = process.env.SEED_DEMO ? process.env.SEED_DEMO === "true" : !production;
if (seedDemo && !get<{ n: number }>(db, "SELECT COUNT(*) n FROM agents WHERE workspace_id = ?", MAIN_WORKSPACE)?.n) {
  console.log(tr("Empty database: creating the demo workspace (100 agents)…", "Base vide : création de l'espace de démonstration (100 agents)…"));
  seed(db);
}
ensureMainRules(db, Date.now());

const app = buildApp({
  db,
  adminToken,
  logger: production,
  trustProxy: process.env.TRUST_PROXY === "true",
  signup: env("SIGNUP", "open") !== "closed",
  google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined,
});

const dist = join(root, "web", "dist");
if (existsSync(dist)) {
  // wildcard (default): files rebuilt after start-up are served too.
  await app.register(fastifyStatic, { root: dist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "Introuvable." });
    return reply.sendFile("index.html");
  });
}

// Time-based detectors (budgets, silence after a fix…) also need a periodic pass.
setInterval(() => {
  evaluateAll(db);
  notifyChange();
}, 60_000).unref();

startReviewer(db);

// n8n: read new executions and enforce pauses every N8N_SYNC_SECONDS (30 by default).
let syncing = false;
setInterval(async () => {
  if (syncing) return;
  syncing = true;
  try { await syncAll(db); } finally { syncing = false; }
}, Number(env("N8N_SYNC_SECONDS", "30")) * 1000).unref();

// Backups and retention: at start-up, then checked every hour (runs once a day).
const maintenance = {
  backupDir: env("BACKUP_DIR", join(dirname(dbPath), "backups")),
  keepDays: Number(env("BACKUP_KEEP_DAYS", "30")),
  retentionDays: Number(env("RETENTION_DAYS", "90")),
};
const maintain = () => {
  try {
    const r = dailyMaintenance(db, maintenance);
    purgeExpiredSessions(db, Date.now());
    if (r.backup || r.purged || r.pruned.length) {
      console.log(tr(
        `Maintenance: ${r.backup ? `backup ${r.backup}, ` : ""}${r.purged} old event(s) deleted, ${r.pruned.length} old backup(s) removed.`,
        `Maintenance : ${r.backup ? `sauvegarde ${r.backup}, ` : ""}${r.purged} événement(s) ancien(s) supprimé(s), ${r.pruned.length} vieille(s) sauvegarde(s) retirée(s).`,
      ));
    }
  } catch (err) {
    console.error(tr("Maintenance failed:", "Maintenance impossible :"), (err as Error).message);
  }
};
maintain();
setInterval(maintain, HOUR).unref();

// Stop cleanly when the host restarts the service: finish requests, close the database.
const shutdown = async (signal: string) => {
  console.log(tr(`${signal} received: shutting down cleanly…`, `${signal} reçu : arrêt propre…`));
  await app.close().catch(() => {});
  db.close();
  process.exit(0);
};
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port, host });
console.log(tr(`${PRODUCT_NAME} listening on port ${port}`, `${PRODUCT_NAME} en ligne sur le port ${port}`) + (production ? " (production)" : ""));
