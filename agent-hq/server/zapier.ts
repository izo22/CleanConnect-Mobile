/**
 * Zapier with one key for the whole workspace.
 *
 * A Zap connects with the workspace's Zapier key and says which agent it is
 * (the "Agent" field of every Orvanta step, sent as the X-Agent header): an
 * existing agent, or a new name, and Orvanta creates that agent. So the owner
 * never has to create agents or copy keys one by one, like with n8n where each
 * workflow becomes an agent by itself.
 *
 * Links shared by the service administrator (the invite to the Orvanta app on
 * Zapier, the ready-to-copy Zaps) are kept in `settings` and shown on the
 * Connections page.
 */
import { all, get, run, type DB } from "./db.ts";
import { tr } from "./i18n.ts";
import { getAgent, logActivity, newApiKey, newZapierKey, type AgentRow } from "./model.ts";
import { PRODUCT_NAME } from "./brand.ts";

export const isZapierKey = (key: string) => key.startsWith("ozk_");

export function workspaceOfZapierKey(db: DB, key: string) {
  return get<{ id: string; name: string }>(db, "SELECT id, name FROM workspaces WHERE zapier_key = ?", key);
}

/** Creates the key, or replaces it: Zaps connected with the old one stop working. */
export function renewZapierKey(db: DB, ws: string) {
  const key = newZapierKey();
  run(db, "UPDATE workspaces SET zapier_key = ? WHERE id = ?", key, ws);
  return key;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "zap";

/**
 * The agent a Zap stands for: `ref` is an agent id picked in Zapier's list,
 * or a name typed by hand. An unknown name creates the agent.
 */
export function zapAgent(db: DB, ws: string, ref: string, zapId: string | null, now: number, create?: true): AgentRow;
export function zapAgent(db: DB, ws: string, ref: string, zapId: string | null, now: number, create: boolean): AgentRow | null;
export function zapAgent(db: DB, ws: string, ref: string, zapId: string | null, now: number, create = true): AgentRow | null {
  const name = ref.trim().slice(0, 80);
  const found =
    get<AgentRow>(db, "SELECT * FROM agents WHERE workspace_id = ? AND id = ?", ws, name) ??
    get<AgentRow>(db, "SELECT * FROM agents WHERE workspace_id = ? AND lower(name) = lower(?) ORDER BY created_at LIMIT 1", ws, name);
  if (found) {
    // Remember the Zap, so the emergency stop can switch this very Zap off.
    if (zapId && found.source === "zapier" && !found.external_id) run(db, "UPDATE agents SET external_id = ? WHERE id = ?", zapId, found.id);
    return getAgent(db, found.id)!;
  }
  if (!create) return null;
  let id = `zap-${slug(name)}`;
  while (getAgent(db, id)) id = `zap-${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
  run(
    db,
    `INSERT INTO agents (id, workspace_id, name, mission, owner_name, owner_email, platform, autonomy, budget_cents, access, api_key, source, external_id, created_at)
     VALUES (?, ?, ?, ?, '', '', 'Zapier', 2, 10000, '[]', ?, 'zapier', ?, ?)`,
    id, ws, name, tr(`Zap “${name}”`, `Zap « ${name} »`), newApiKey(), zapId, now,
  );
  logActivity(db, PRODUCT_NAME, tr(`New Zap followed: ${name}`, `Nouveau Zap suivi : ${name}`), id, now);
  return getAgent(db, id)!;
}

// ---------- Links shared by the service administrator ----------

export const ZAPIER_LINKS = ["invite_url", "monitor_url", "pause_url", "permission_url"] as const;
export type ZapierLinks = Partial<Record<(typeof ZAPIER_LINKS)[number], string>>;

export function zapierLinks(db: DB): ZapierLinks {
  const row = get<{ value: string }>(db, "SELECT value FROM settings WHERE key = 'zapier_links'");
  return row ? JSON.parse(row.value) : {};
}

export function saveZapierLinks(db: DB, links: ZapierLinks) {
  const clean = Object.fromEntries(ZAPIER_LINKS.map((k) => [k, links[k]?.trim() || undefined]).filter(([, v]) => v));
  run(db, "INSERT INTO settings (key, value) VALUES ('zapier_links', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", JSON.stringify(clean));
}

/** What the Connections page shows about Zapier. */
export function zapierView(db: DB, ws: string) {
  const key = get<{ zapier_key: string | null }>(db, "SELECT zapier_key FROM workspaces WHERE id = ?", ws)?.zapier_key ?? null;
  const zaps = all<{ id: string; name: string; last_check_at: number | null; last_event: number | null }>(
    db,
    `SELECT a.id, a.name, a.last_check_at, (SELECT MAX(ts) FROM events e WHERE e.agent_id = a.id) AS last_event
     FROM agents a WHERE a.workspace_id = ? AND a.source = 'zapier' ORDER BY a.name`,
    ws,
  );
  return { key, links: zapierLinks(db), zaps };
}
