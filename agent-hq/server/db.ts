import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type DB = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mission TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'custom',
  autonomy INTEGER NOT NULL DEFAULT 1 CHECK (autonomy BETWEEN 0 AND 2),
  paused INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  budget_cents INTEGER NOT NULL DEFAULT 10000,
  model_tier TEXT NOT NULL DEFAULT 'standard',
  expected_language TEXT,
  access TEXT NOT NULL DEFAULT '[]',
  minutes_per_task REAL NOT NULL DEFAULT 3,
  api_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (agent_id, version)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('task', 'action', 'error')),
  action TEXT,
  target TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  cost_cents REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  language TEXT,
  error_code TEXT,
  error_message TEXT,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS events_agent_ts ON events (agent_id, ts);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'blocked')),
  title TEXT NOT NULL,
  cause TEXT NOT NULL,
  impact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS alerts_open ON alerts (status, agent_id, kind);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  title TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  amount_cents INTEGER,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('ok', 'doubt', 'error')),
  score INTEGER NOT NULL,
  summary TEXT NOT NULL,
  issues TEXT NOT NULL DEFAULT '[]',
  reviewer TEXT NOT NULL,
  human_verdict TEXT CHECK (human_verdict IN ('confirmed', 'dismissed')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_agent ON reviews (agent_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at INTEGER NOT NULL
);

-- Connections to automation platforms (n8n today). Agent HQ reads their
-- workflows and executions itself, so supervision needs no change in them.
CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('n8n')),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  cursor_execution_id INTEGER NOT NULL DEFAULT 0,
  last_sync_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL
);

-- Subscriptions from automation platforms (Zapier REST hooks): Agent HQ
-- POSTs to target_url when a decision is taken or an agent is paused/resumed.
CREATE TABLE IF NOT EXISTS hooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('decision', 'agent_state')),
  target_url TEXT NOT NULL,
  filter TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  actor TEXT NOT NULL,
  agent_id TEXT,
  message TEXT NOT NULL
);
`;

export function openDb(path = ":memory:"): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Columns added after the first release; ALTER them into older databases. */
const ADDED_COLUMNS: Array<[table: string, column: string, ddl: string]> = [
  ["events", "input", "TEXT"],
  ["events", "output", "TEXT"],
  // NULL = not sampled, 'pending' = waiting for the AI reviewer, 'done' = reviewed.
  ["events", "review_state", "TEXT"],
  ["agents", "review_rate", "REAL NOT NULL DEFAULT 0.1"],
  // Where the agent lives: 'sdk' (reports itself) or 'n8n' (read from an n8n instance).
  ["agents", "source", "TEXT NOT NULL DEFAULT 'sdk'"],
  ["agents", "integration_id", "INTEGER"],
  ["agents", "external_id", "TEXT"],
  // Last time the agent asked permission before acting: proves "control" is wired.
  ["agents", "last_check_at", "INTEGER"],
  // Identifier on the source platform (n8n execution id), to never import twice.
  ["events", "external_ref", "TEXT"],
  // Where to send the human decision (an n8n "Wait" node resume URL).
  ["approvals", "callback_url", "TEXT"],
  ["approvals", "callback_status", "TEXT"],
];

function migrate(db: DB) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
  db.exec("CREATE INDEX IF NOT EXISTS events_review ON events (review_state) WHERE review_state = 'pending'");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS events_external ON events (agent_id, external_ref) WHERE external_ref IS NOT NULL");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS agents_external ON agents (integration_id, external_id) WHERE external_id IS NOT NULL");
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Typed helpers around node:sqlite, which returns loosely typed rows. */
export function all<T>(db: DB, sql: string, ...params: SqlParam[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T>(db: DB, sql: string, ...params: SqlParam[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(db: DB, sql: string, ...params: SqlParam[]) {
  return db.prepare(sql).run(...params);
}

export type SqlParam = string | number | null | bigint;
