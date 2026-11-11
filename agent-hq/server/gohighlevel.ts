/**
 * GoHighLevel: workflows talk to Orvanta with a plain "Webhook" action.
 *
 * GoHighLevel's webhook actions cannot add an Authorization header, so the
 * workspace's GoHighLevel key travels in the URL path (like a Slack incoming
 * webhook). Two addresses:
 *
 * - …/activity  tells Orvanta what the workflow just did (or that it failed);
 * - …/check     asks permission before a sensitive step. When a human has to
 *               decide, Orvanta later POSTs the decision to `continue_url`,
 *               the address of a second workflow that starts with GoHighLevel's
 *               "Inbound Webhook" trigger.
 *
 * Settings come from the URL's query string, the action's "Custom data"
 * (`customData`), or an `orvanta` object for Custom Webhook bodies, in that
 * order of priority. The contact, location and workflow GoHighLevel sends are
 * read loosely, since the exact shape of its payload varies by action.
 *
 * Each workflow becomes an agent, named after the sub-account and the
 * workflow (or the `agent` setting), so an agency sees every client's
 * workflows in one place.
 */
import { get, run, type DB } from "./db.ts";
import { tr } from "./i18n.ts";
import { getAgent, logActivity, newApiKey, newGhlKey, type AgentRow } from "./model.ts";
import { PRODUCT_NAME } from "./brand.ts";

export const isGhlKey = (key: string) => /^ogh_[A-Za-z0-9_-]{20,}$/.test(key);

export function workspaceOfGhlKey(db: DB, key: string) {
  if (!isGhlKey(key)) return undefined;
  return get<{ id: string; name: string }>(db, "SELECT id, name FROM workspaces WHERE ghl_key = ?", key);
}

/** Creates the key, or replaces it: webhooks using the old addresses stop working. */
export function renewGhlKey(db: DB, ws: string) {
  const key = newGhlKey();
  run(db, "UPDATE workspaces SET ghl_key = ? WHERE id = ?", key, ws);
  return key;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | undefined => {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
};
const first = (...vals: unknown[]) => vals.map(str).find((v) => v !== undefined);

/** The Orvanta settings of one webhook call, from the URL, the custom data, or an `orvanta` object. */
const SETTING_KEYS = ["agent", "action", "status", "error", "error_message", "summary", "details", "amount", "cost", "target",
  "sensitive", "always_ask", "require_approval", "input", "output", "continue_url"];

export function ghlSettings(body: unknown, query: Obj): Obj {
  const b = obj(body);
  // Plain form posts put everything at the top: only our own setting names are read there.
  const top = Object.fromEntries(SETTING_KEYS.filter((k) => k in b && typeof b[k] !== "object").map((k) => [k, b[k]]));
  return { ...top, ...obj(b.orvanta), ...obj(b.customData), ...obj(b.custom_data), ...query };
}

export interface GhlContext {
  contact: { contact_id?: string; email?: string; phone?: string; first_name?: string; last_name?: string; full_name?: string };
  location: { id?: string; name?: string };
  workflow: { id?: string; name?: string };
}

/** Who and where the call is about, wherever GoHighLevel put it. */
export function ghlContext(body: unknown): GhlContext {
  const b = obj(body);
  const c = obj(b.contact);
  const loc = obj(b.location);
  const wf = obj(b.workflow);
  const first_name = first(b.first_name, b.firstName, c.first_name, c.firstName);
  const last_name = first(b.last_name, b.lastName, c.last_name, c.lastName);
  const contact = {
    contact_id: first(b.contact_id, b.contactId, c.id, c.contact_id),
    email: first(b.email, c.email),
    phone: first(b.phone, c.phone),
    first_name,
    last_name,
    full_name: first(b.full_name, b.fullName, b.name, c.name, [first_name, last_name].filter(Boolean).join(" ")),
  };
  return {
    contact: Object.fromEntries(Object.entries(contact).filter(([, v]) => v !== undefined)),
    location: { id: first(loc.id, b.location_id, b.locationId), name: first(loc.name, b.location_name) },
    workflow: { id: first(wf.id, b.workflow_id, b.workflowId), name: first(wf.name, b.workflow_name) },
  };
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workflow";

/** The agent name: the `agent` setting, else "Sub-account · Workflow". */
export function ghlAgentName(settings: Obj, ctx: GhlContext): string {
  const named = str(settings.agent);
  if (named) return named.slice(0, 80);
  const parts = [ctx.location.name, ctx.workflow.name].filter(Boolean);
  return (parts.length ? parts.join(" · ") : tr("GoHighLevel workflow", "Workflow GoHighLevel")).slice(0, 80);
}

/** The agent a GoHighLevel workflow stands for, created the first time it calls. */
export function ghlAgent(db: DB, ws: string, name: string, workflowId: string | undefined, now: number): AgentRow {
  const found = get<AgentRow>(db, "SELECT * FROM agents WHERE workspace_id = ? AND lower(name) = lower(?) ORDER BY created_at LIMIT 1", ws, name);
  if (found) return found;
  let id = `ghl-${slug(name)}`;
  while (getAgent(db, id)) id = `ghl-${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
  run(
    db,
    `INSERT INTO agents (id, workspace_id, name, mission, owner_name, owner_email, platform, autonomy, budget_cents, access, api_key, source, external_id, created_at)
     VALUES (?, ?, ?, ?, '', '', 'GoHighLevel', 2, 10000, '[]', ?, 'ghl', ?, ?)`,
    id, ws, name, tr(`GoHighLevel workflow “${name}”`, `Workflow GoHighLevel « ${name} »`), newApiKey(), workflowId ?? null, now,
  );
  logActivity(db, PRODUCT_NAME, tr(`New GoHighLevel workflow followed: ${name}`, `Nouveau workflow GoHighLevel suivi : ${name}`), id, now, ws);
  return getAgent(db, id)!;
}

const truthy = (v: unknown) => v === true || (typeof v === "string" && ["true", "1", "yes", "oui"].includes(v.trim().toLowerCase()));

/** "1,250.50", "$1250", 1250 → 125050 cents. */
export function toCents(v: unknown): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  if (!/\d/.test(s)) return undefined;
  const n = Number(s.replace(/[^0-9.,-]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

const clip = (v: string | undefined, max: number) => (v === undefined ? undefined : v.slice(0, max));

/** The event stored for an "activity" call. */
export function ghlEvent(settings: Obj, ctx: GhlContext) {
  const status = (str(settings.status) ?? "success").toLowerCase();
  const failed = ["failure", "failed", "error", "fail", "echec", "échec"].includes(status);
  const who = ctx.contact.full_name || ctx.contact.email || ctx.contact.phone;
  return {
    kind: failed ? ("error" as const) : ("task" as const),
    success: !failed,
    action: clip(first(settings.action, ctx.workflow.name) ?? "ghl.workflow", 200),
    target: clip(first(settings.target, who), 500),
    cost_cents: toCents(settings.cost),
    error_message: failed ? clip(first(settings.error, settings.error_message) ?? tr("Failure reported by GoHighLevel", "Échec signalé par GoHighLevel"), 2000) : undefined,
    input: clip(str(settings.input), 20_000),
    output: clip(str(settings.output), 20_000),
    meta: { ...ctx.contact, location_id: ctx.location.id, location_name: ctx.location.name, workflow_id: ctx.workflow.id, workflow_name: ctx.workflow.name },
  };
}

/** The permission request for a "check" call. */
export function ghlCheck(settings: Obj, ctx: GhlContext, body: unknown) {
  const action = first(settings.action) ?? "ghl.action";
  const who = ctx.contact.full_name || ctx.contact.email || ctx.contact.phone;
  const summary = first(settings.summary) ?? (who ? `${action}: ${who}` : action);
  const details = [
    who && tr(`Contact: ${who}`, `Contact : ${who}`),
    ctx.contact.email && ctx.contact.email !== who && `Email: ${ctx.contact.email}`,
    ctx.contact.phone && ctx.contact.phone !== who && tr(`Phone: ${ctx.contact.phone}`, `Téléphone : ${ctx.contact.phone}`),
    ctx.location.name && tr(`Sub-account: ${ctx.location.name}`, `Sous-compte : ${ctx.location.name}`),
    ctx.workflow.name && `Workflow: ${ctx.workflow.name}`,
    str(settings.details),
  ].filter(Boolean).join(" · ");
  // Keep what the next workflow needs; the full GoHighLevel payload only when it is small.
  const raw = JSON.stringify(body ?? {});
  return {
    action: action.slice(0, 200),
    summary: summary.slice(0, 300),
    context: details.slice(0, 3000) || undefined,
    amount_cents: toCents(settings.amount),
    target: clip(first(settings.target, who), 500),
    sensitive: truthy(settings.sensitive) || undefined,
    require_approval: truthy(settings.always_ask) || truthy(settings.require_approval) || undefined,
    input: clip(str(settings.input), 20_000),
    output: clip(str(settings.output), 20_000),
    payload: { ghl: { ...ctx.contact, location_id: ctx.location.id, workflow_id: ctx.workflow.id }, ...(raw.length <= 20_000 ? { request: body } : {}) },
  };
}

/** Top-level contact fields, so GoHighLevel's Inbound Webhook can map them in one click. */
export function ghlContactFields(payload: unknown): Obj {
  const g = obj(obj(payload).ghl);
  const keys = ["contact_id", "email", "phone", "first_name", "last_name", "full_name", "location_id"];
  return Object.fromEntries(keys.filter((k) => str(g[k]) !== undefined).map((k) => [k, g[k]]));
}

/** What the Connections page shows about GoHighLevel. */
export function ghlView(db: DB, ws: string) {
  const key = get<{ ghl_key: string | null }>(db, "SELECT ghl_key FROM workspaces WHERE id = ?", ws)?.ghl_key ?? null;
  const workflows = db.prepare(
    `SELECT a.id, a.name, a.paused, a.last_check_at, (SELECT MAX(ts) FROM events e WHERE e.agent_id = a.id) AS last_event
     FROM agents a WHERE a.workspace_id = ? AND a.source = 'ghl' ORDER BY a.name`,
  ).all(ws) as Array<{ id: string; name: string; paused: number; last_check_at: number | null; last_event: number | null }>;
  return { key, workflows };
}
