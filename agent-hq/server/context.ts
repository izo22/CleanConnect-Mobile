/**
 * Who is calling the dashboard API, and in which workspace. Three kinds of
 * callers: a signed-in person (session cookie), a script holding the setup
 * code (x-admin-token), and, when no setup code is configured (local trial,
 * tests), everyone, with full access.
 */
import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ROLE_RANK, SESSION_COOKIE, getWorkspace, readCookie, sessionUser, workspacesOf, type Role } from "./auth.ts";
import { MAIN_WORKSPACE, type DB } from "./db.ts";
import { tr } from "./i18n.ts";

export interface Caller {
  /** 0 for the setup-code holder and for open mode: not a stored account. */
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface Ctx {
  user: Caller;
  ws: string;
  wsName: string;
  role: Role;
  /** Name written in the journal. */
  actor: string;
}

declare module "fastify" {
  interface FastifyRequest {
    ctx: Ctx;
  }
}

/** Comparison that takes the same time whatever the input, so the code cannot be guessed char by char. */
export function sameSecret(given: unknown, expected: string) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const httpError = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });

export function makeGuards({ db, adminToken, now }: { db: DB; adminToken?: string; now: () => number }) {
  const accounts = !!adminToken;

  function caller(req: FastifyRequest): Caller | null {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) {
      const u = sessionUser(db, token, now());
      if (u) return { id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin };
    }
    if (adminToken && sameSecret(req.headers["x-admin-token"], adminToken)) return { id: 0, name: "Admin", email: "", isAdmin: true };
    if (!accounts) {
      const raw = req.headers["x-user-name"];
      const name = typeof raw === "string" ? decodeURIComponent(raw).trim().slice(0, 60) : "";
      return { id: 0, name: name || tr("You", "Vous"), email: "", isAdmin: true };
    }
    return null;
  }

  const signInFirst = (reply: FastifyReply) => reply.code(401).send({ error: tr("Please sign in.", "Veuillez vous connecter.") });

  async function requireUser(req: FastifyRequest, reply: FastifyReply) {
    const user = caller(req);
    if (!user) return signInFirst(reply);
    req.ctx = { user, ws: "", wsName: "", role: "viewer", actor: user.name };
  }

  async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
    const user = caller(req);
    if (!user) return signInFirst(reply);
    if (!user.isAdmin) return reply.code(403).send({ error: tr("Reserved for the platform administrator.", "Réservé à l'administrateur de la plateforme.") });
    req.ctx = { user, ws: "", wsName: "", role: "viewer", actor: user.name };
  }

  /** Workspace asked in the x-workspace header (or ?ws= for live updates), else the caller's first one. */
  async function requireWorkspace(req: FastifyRequest, reply: FastifyReply) {
    const user = caller(req);
    if (!user) return signInFirst(reply);
    const header = req.headers["x-workspace"];
    const query = (req.query as Record<string, unknown> | undefined)?.ws;
    const asked = typeof header === "string" && header ? header : typeof query === "string" && query ? query : null;

    if (user.id === 0) {
      const w = getWorkspace(db, asked ?? MAIN_WORKSPACE);
      if (!w) return reply.code(404).send({ error: tr("Workspace not found.", "Espace introuvable.") });
      req.ctx = { user, ws: w.id, wsName: w.name, role: "owner", actor: user.name };
      return;
    }
    const mine = workspacesOf(db, user.id);
    const pick = asked ? mine.find((w) => w.id === asked) : mine[0];
    if (!pick) {
      return reply.code(403).send({
        error: asked
          ? tr("You don't have access to this workspace.", "Vous n'avez pas accès à cet espace.")
          : tr("You are not part of any workspace yet.", "Vous ne faites encore partie d'aucun espace."),
      });
    }
    req.ctx = { user, ws: pick.id, wsName: pick.name, role: pick.role, actor: user.name };
  }

  /** Throws unless the caller's role in the workspace is at least `role`. */
  function need(req: FastifyRequest, role: Role) {
    if (ROLE_RANK[req.ctx.role] < ROLE_RANK[role]) {
      throw httpError(403, tr("Your role in this workspace doesn't allow this action.", "Votre rôle dans cet espace ne permet pas cette action."));
    }
  }

  return { accounts, caller, requireUser, requireAdmin, requireWorkspace, need };
}
