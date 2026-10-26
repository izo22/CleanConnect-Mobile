import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.ts";
import { seed } from "./seed.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = openDb(process.env.DATABASE_PATH ?? join(root, "data", "agent-hq.db"));
const started = Date.now();
seed(db);
console.log(`Espace de démonstration recréé en ${Date.now() - started} ms.`);
