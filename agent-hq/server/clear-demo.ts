/**
 * Removes the 100-agent demo from the first workspace, for good. Accounts,
 * members and the other workspaces are untouched; a backup is made first.
 *   docker compose exec app node --import tsx server/clear-demo.ts
 * Set SEED_DEMO=false in .env before, or the demo comes back at the next start.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAIN_WORKSPACE, get, openDb } from "./db.ts";
import { tr } from "./i18n.ts";
import { backupNow } from "./maintenance.ts";
import { clearDemo } from "./seed.ts";

if (process.env.SEED_DEMO === "true") {
  console.error(tr(
    "SEED_DEMO=true: the demo would come back at the next start. Set SEED_DEMO=false in .env, run `docker compose up -d`, then try again.",
    "SEED_DEMO=true : la démo reviendrait au prochain démarrage. Mettez SEED_DEMO=false dans .env, lancez `docker compose up -d`, puis recommencez.",
  ));
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.DATABASE_PATH ?? join(root, "data", "agent-hq.db");
const db = openDb(dbPath);
const backup = backupNow(db, process.env.BACKUP_DIR ?? join(dirname(dbPath), "backups"));
const before = get<{ n: number }>(db, "SELECT COUNT(*) n FROM agents WHERE workspace_id = ?", MAIN_WORKSPACE)?.n ?? 0;
clearDemo(db);
console.log(tr(
  `Done: ${before} agent(s) removed from the first workspace. Backup made before: ${backup}`,
  `Terminé : ${before} agent(s) retiré(s) du premier espace. Sauvegarde faite avant : ${backup}`,
));
