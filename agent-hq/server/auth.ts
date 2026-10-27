/**
 * Accounts: passwords (scrypt), sessions (httpOnly cookie) and single-use
 * links (invitations to a workspace, password resets). No email is sent:
 * the person who creates a link sees it and passes it on.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { MAIN_WORKSPACE, all, get, run, type DB } from "./db.ts";
import { timezone, tr } from "./i18n.ts";
import { DAY } from "./model.ts";

export type Role = "owner" | "member" | "viewer";
export const ROLES: Role[] = ["owner", "member", "viewer"];
export const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, owner: 2 };

export interface UserRow { id: number; email: string; name: string; password_hash: string; is_admin: number; created_at: number }
export interface WorkspaceRow { id: string; name: string; created_at: number }
export interface LinkRow {
  id: number; kind: "invite" | "reset"; email: string; workspace_id: string | null; role: Role | null;
  created_by: number | null; created_at: number; expires_at: number; used_at: number | null;
}

export const SESSION_COOKIE = "orvanta_session";
export const SESSION_DAYS = 30;
export const MIN_PASSWORD = 10;
const LINK_DAYS = 7;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// ---------- Passwords ----------

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

/** Same work as a real check, so an unknown email answers as slowly as a wrong password. */
const DECOY = "scrypt$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);
export const spendPasswordTime = (password: string) => verifyPassword(password, DECOY);

export const passwordProblem = (password: string) =>
  password.length < MIN_PASSWORD
    ? tr(`The password must be at least ${MIN_PASSWORD} characters long.`, `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`)
    : null;

// ---------- Sessions ----------

export function createSession(db: DB, userId: number, now: number): string {
  const token = newToken();
  run(db, "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", sha256(token), userId, now, now + SESSION_DAYS * DAY);
  return token;
}

export function sessionUser(db: DB, token: string, now: number) {
  return get<UserRow>(
    db,
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
    sha256(token), now,
  );
}

export const endSession = (db: DB, token: string) => run(db, "DELETE FROM sessions WHERE token_hash = ?", sha256(token));
export const endAllSessions = (db: DB, userId: number) => run(db, "DELETE FROM sessions WHERE user_id = ?", userId);
export const purgeExpiredSessions = (db: DB, now: number) => Number(run(db, "DELETE FROM sessions WHERE expires_at <= ?", now).changes);

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean, maxAgeSeconds = SESSION_DAYS * 86_400) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

// ---------- Users and workspaces ----------

export const countUsers = (db: DB) => get<{ n: number }>(db, "SELECT COUNT(*) n FROM users")?.n ?? 0;
export const getUser = (db: DB, id: number) => get<UserRow>(db, "SELECT * FROM users WHERE id = ?", id);
export const getUserByEmail = (db: DB, email: string) => get<UserRow>(db, "SELECT * FROM users WHERE email = ?", normalizeEmail(email));
export const getWorkspace = (db: DB, id: string) => get<WorkspaceRow>(db, "SELECT * FROM workspaces WHERE id = ?", id);

export function createUser(db: DB, u: { email: string; name: string; passwordHash: string; isAdmin?: boolean }, now: number): number {
  const res = run(
    db,
    "INSERT INTO users (email, name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)",
    normalizeEmail(u.email), u.name.trim(), u.passwordHash, u.isAdmin ? 1 : 0, now,
  );
  return Number(res.lastInsertRowid);
}

/** The first workspace (the platform's own) comes first, then by age. */
export function workspacesOf(db: DB, userId: number) {
  return all<{ id: string; name: string; role: Role }>(
    db,
    "SELECT w.id, w.name, m.role FROM memberships m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = ? ORDER BY w.id = 'main' DESC, w.created_at, w.name",
    userId,
  );
}

export const allWorkspaces = (db: DB) => all<WorkspaceRow>(db, "SELECT * FROM workspaces ORDER BY id = 'main' DESC, created_at, name");

export const roleIn = (db: DB, userId: number, workspaceId: string) =>
  get<{ role: Role }>(db, "SELECT role FROM memberships WHERE user_id = ? AND workspace_id = ?", userId, workspaceId)?.role;

export function addMember(db: DB, userId: number, workspaceId: string, role: Role, now: number) {
  run(
    db,
    `INSERT INTO memberships (user_id, workspace_id, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, workspace_id) DO UPDATE SET role = excluded.role`,
    userId, workspaceId, role, now,
  );
}

export function members(db: DB, workspaceId: string) {
  return all<{ user_id: number; name: string; email: string; role: Role; created_at: number }>(
    db,
    "SELECT u.id user_id, u.name, u.email, m.role, m.created_at FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at",
    workspaceId,
  );
}

export const ownerCount = (db: DB, workspaceId: string) =>
  get<{ n: number }>(db, "SELECT COUNT(*) n FROM memberships WHERE workspace_id = ? AND role = 'owner'", workspaceId)?.n ?? 0;

/** A new client workspace starts with the usual guardrails, ready to adjust. */
export function addDefaultRules(db: DB, workspaceId: string, now: number) {
  let order = 0;
  const rule = (key: string, kind: string, label: string, params: object, enabled: boolean) =>
    run(
      db,
      "INSERT OR IGNORE INTO rules (id, workspace_id, kind, label, params, enabled, trigger_count, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
      `${workspaceId}:${key}`, workspaceId, kind, label, JSON.stringify(params), enabled ? 1 : 0, now + order++,
    );
  rule("refunds", "approval_amount", tr("refund", "remboursement"), { action_prefix: "stripe.refund", max_cents: 20000 }, true);
  rule("quiet-hours", "quiet_hours", tr("customer email", "e-mail client"), { action_prefix: "email.send", start_hour: 22, end_hour: 7, timezone: timezone() }, false);
  rule("monthly-budget", "global_budget", "budget", { max_cents: 100000 }, true);
  rule("repeat-pause", "repeat_pause", tr("duplicates", "doublons"), { count: 10, window_min: 60 }, true);
}

/** The first workspace gets the default guardrails too when it has none (fresh install without demo). */
export function ensureMainRules(db: DB, now: number) {
  if (!get(db, "SELECT 1 FROM rules WHERE workspace_id = ?", MAIN_WORKSPACE)) addDefaultRules(db, MAIN_WORKSPACE, now);
}

export function createWorkspace(db: DB, name: string, now: number): WorkspaceRow {
  const id = "ws_" + randomBytes(6).toString("base64url").replace(/[-_]/g, "x");
  run(db, "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)", id, name.trim(), now);
  addDefaultRules(db, id, now);
  return getWorkspace(db, id)!;
}

// ---------- Single-use links ----------

export function createLink(
  db: DB,
  l: { kind: "invite" | "reset"; email: string; workspaceId?: string; role?: Role; createdBy: number | null },
  now: number,
): string {
  const token = newToken();
  run(
    db,
    "INSERT INTO invites (token_hash, kind, email, workspace_id, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    sha256(token), l.kind, normalizeEmail(l.email), l.workspaceId ?? null, l.role ?? null, l.createdBy, now, now + LINK_DAYS * DAY,
  );
  return token;
}

export const linkByToken = (db: DB, token: string, now: number) =>
  get<LinkRow>(db, "SELECT * FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?", sha256(token), now);

export const markLinkUsed = (db: DB, id: number, now: number) => run(db, "UPDATE invites SET used_at = ? WHERE id = ?", now, id);

export function pendingInvites(db: DB, workspaceId: string, now: number) {
  return all<{ id: number; email: string; role: Role; created_at: number; expires_at: number }>(
    db,
    "SELECT id, email, role, created_at, expires_at FROM invites WHERE kind = 'invite' AND workspace_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC",
    workspaceId, now,
  );
}

export const revokeInvite = (db: DB, workspaceId: string, id: number) =>
  Number(run(db, "DELETE FROM invites WHERE id = ? AND workspace_id = ? AND kind = 'invite'", id, workspaceId).changes) > 0;
