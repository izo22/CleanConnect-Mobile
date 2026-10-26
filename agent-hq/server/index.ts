import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app.ts";
import { get, openDb } from "./db.ts";
import { evaluateAll } from "./engine.ts";
import { notifyChange } from "./model.ts";
import { syncAll } from "./n8n.ts";
import { startReviewer } from "./reviewer.ts";
import { seed } from "./seed.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.DATABASE_PATH ?? join(root, "data", "agent-hq.db");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const db = openDb(dbPath);
if (!get<{ n: number }>(db, "SELECT COUNT(*) n FROM agents")?.n && process.env.SEED_DEMO !== "false") {
  console.log("Base vide : création de l'espace de démonstration (100 agents)…");
  seed(db);
}

const app = buildApp({ db, adminToken: process.env.ADMIN_TOKEN, logger: process.env.NODE_ENV !== "production" ? false : true });

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
}, Number(process.env.N8N_SYNC_SECONDS ?? 30) * 1000).unref();

await app.listen({ port, host });
console.log(`Agent HQ en ligne sur http://localhost:${port}`);
