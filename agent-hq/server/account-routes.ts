/**
 * Accounts API: first-account setup, sign in and out, invitation and reset
 * links, workspaces and their members, and the platform administrator's view.
 */
import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  MIN_PASSWORD,
  ROLES,
  addMember,
  allWorkspaces,
  countUsers,
  createLink,
  createSession,
  createUser,
  createWorkspace,
  endAllSessions,
  endSession,
  getUser,
  getUserByEmail,
  getWorkspace,
  hashPassword,
  linkByToken,
  markLinkUsed,
  members,
  normalizeEmail,
  ownerCount,
  passwordProblem,
  pendingInvites,
  readCookie,
  revokeInvite,
  roleIn,
  SESSION_COOKIE,
  sessionCookie,
  spendPasswordTime,
  verifyPassword,
  workspacesOf,
  type Role,
} from "./auth.ts";
import { httpError, sameSecret, type Caller, type makeGuards } from "./context.ts";
import { MAIN_WORKSPACE, all, get, run, tx, type DB } from "./db.ts";
import { rateLimiter } from "./early-access.ts";
import { tr } from "./i18n.ts";
import { DAY, HOUR, MINUTE, logActivity, notifyChange } from "./model.ts";
import { notify } from "./notify.ts";

interface Deps {
  db: DB;
  adminToken?: string;
  now: () => number;
  guards: ReturnType<typeof makeGuards>;
  /** Visitors may create their own account and workspace. */
  signup?: boolean;
  google?: { clientId: string; clientSecret: string };
  fetchImpl?: typeof fetch;
}

interface GoogleProfile { email?: string; email_verified?: boolean; name?: string }

const EMAIL = { type: "string", minLength: 3, maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" } as const;
const PASSWORD = { type: "string", minLength: 1, maxLength: 200 } as const;
const NAME = { type: "string", minLength: 1, maxLength: 80 } as const;
const ROLE = { enum: ROLES } as const;
const body = (properties: Record<string, unknown>, required: string[]) => ({ schema: { body: { type: "object", additionalProperties: false, required, properties } } });

export function registerAccountRoutes(app: FastifyInstance, { db, adminToken, now, guards, signup = false, google, fetchImpl = fetch }: Deps) {
  const { accounts, caller, requireUser, requireAdmin, requireWorkspace, need } = guards;

  const startSession = (req: FastifyRequest, reply: FastifyReply, userId: number) => {
    const token = createSession(db, userId, now());
    reply.header("set-cookie", sessionCookie(token, req.protocol === "https"));
  };

  /** Links open the app on the page that uses them. */
  const linkUrl = (req: FastifyRequest, token: string) => {
    const base = (process.env.PUBLIC_URL ?? `${req.protocol}://${req.headers.host}`).replace(/\/+$/, "");
    return `${base}/#/link/${token}`;
  };

  const me = (user: Caller) => ({
    mode: accounts ? "accounts" : "open",
    user: { id: user.id, name: user.name, email: user.email, is_admin: user.isAdmin, has_password: user.id ? !!getUser(db, user.id)?.password_hash : false },
    workspaces: user.id === 0 ? allWorkspaces(db).map((w) => ({ id: w.id, name: w.name, role: "owner" as Role })) : workspacesOf(db, user.id),
    early_access: user.isAdmin ? get<{ n: number }>(db, "SELECT COUNT(*) n FROM early_access")?.n ?? 0 : 0,
  });

  // ---------- Signing in ----------

  // Sign-up opens once the administrator's account exists.
  const signupOpen = () => signup && accounts && countUsers(db) > 0;

  app.get("/api/auth/state", async () => ({ mode: accounts ? "accounts" : "open", setup_needed: accounts && countUsers(db) === 0, signup: signupOpen(), google: accounts && !!google }));

  // The very first account: proven by the setup code written in the server's settings (ADMIN_TOKEN).
  app.post<{ Body: { setup_code: string; name: string; email: string; password: string } }>(
    "/api/auth/setup",
    body({ setup_code: PASSWORD, name: NAME, email: EMAIL, password: PASSWORD }, ["setup_code", "name", "email", "password"]),
    async (req, reply) => {
      if (!accounts || countUsers(db) > 0) throw httpError(409, tr("This server already has accounts. Please sign in.", "Ce serveur a déjà des comptes. Connectez-vous."));
      if (!sameSecret(req.body.setup_code, adminToken!)) throw httpError(403, tr("Wrong setup code.", "Code d'installation incorrect."));
      const problem = passwordProblem(req.body.password);
      if (problem) throw httpError(400, problem);
      const hash = await hashPassword(req.body.password);
      const t = now();
      const userId = tx(db, () => {
        const id = createUser(db, { email: req.body.email, name: req.body.name, passwordHash: hash, isAdmin: true }, t);
        addMember(db, id, MAIN_WORKSPACE, "owner", t);
        return id;
      });
      startSession(req, reply, userId);
      return reply.code(201).send(me({ id: userId, name: req.body.name.trim(), email: normalizeEmail(req.body.email), isAdmin: true }));
    },
  );

  // Self sign-up: a new person gets their own empty workspace, as its owner.
  const signupByIp = rateLimiter(5, HOUR);
  const signupsPerDay = rateLimiter(100, DAY);
  app.post<{ Body: { name: string; company?: string; email: string; password: string; website?: string } }>(
    "/api/auth/signup",
    body({ name: NAME, company: { type: "string", maxLength: 80 }, email: EMAIL, password: PASSWORD, website: { type: "string", maxLength: 200 } }, ["name", "email", "password"]),
    async (req, reply) => {
      if (!signupOpen()) throw httpError(403, tr("Sign-up is closed on this server. Ask for an invitation.", "L'inscription est fermée sur ce serveur. Demandez une invitation."));
      // Bots fill in the field hidden from people: pretend it worked.
      if (req.body.website) return reply.code(201).send({});
      if (!signupByIp(req.ip, now()) || !signupsPerDay("all", now())) {
        throw httpError(429, tr("Too many sign-ups right now. Please try again in an hour.", "Trop d'inscriptions pour le moment. Réessayez dans une heure."));
      }
      if (getUserByEmail(db, req.body.email)) {
        throw httpError(409, tr("An account already uses this email. Sign in instead.", "Un compte utilise déjà cet e-mail. Connectez-vous plutôt."));
      }
      const problem = passwordProblem(req.body.password);
      if (problem) throw httpError(400, problem);
      const hash = await hashPassword(req.body.password);
      const name = req.body.name.trim();
      const company = req.body.company?.trim();
      const t = now();
      const userId = tx(db, () => {
        const id = createUser(db, { email: req.body.email, name, passwordHash: hash, verified: false }, t);
        const w = createWorkspace(db, company || tr(`${name}'s workspace`, `Espace de ${name}`), t);
        addMember(db, id, w.id, "owner", t);
        logActivity(db, name, tr(`${name} created the workspace.`, `${name} a créé l'espace.`), null, t, w.id);
        return id;
      });
      startSession(req, reply, userId);
      const who = `${name}${company ? ` (${company})` : ""}, ${normalizeEmail(req.body.email)}`;
      notify(tr(`New sign-up: ${who}`, `Nouvelle inscription : ${who}`));
      notifyChange();
      return reply.code(201).send(me({ id: userId, name, email: normalizeEmail(req.body.email), isAdmin: false }));
    },
  );

  const loginByIp = rateLimiter(20, 15 * MINUTE);
  const loginByEmail = rateLimiter(10, 15 * MINUTE);
  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    body({ email: { type: "string", maxLength: 200 }, password: PASSWORD }, ["email", "password"]),
    async (req, reply) => {
      const email = normalizeEmail(req.body.email);
      if (!loginByIp(req.ip, now()) || !loginByEmail(email, now())) {
        throw httpError(429, tr("Too many attempts. Please wait 15 minutes.", "Trop de tentatives. Patientez 15 minutes."));
      }
      const user = getUserByEmail(db, email);
      const ok = user ? await verifyPassword(req.body.password, user.password_hash) : (await spendPasswordTime(req.body.password), false);
      if (!user || !ok) throw httpError(401, tr("Wrong email or password.", "E-mail ou mot de passe incorrect."));
      startSession(req, reply, user.id);
      return me({ id: user.id, name: user.name, email: user.email, isAdmin: !!user.is_admin });
    },
  );

  // ---------- Continue with Google ----------

  const OAUTH_COOKIE = "orvanta_oauth";
  const appBase = (req: FastifyRequest) => (process.env.PUBLIC_URL ?? `${req.protocol}://${req.headers.host}`).replace(/\/+$/, "");
  const googleRedirect = (req: FastifyRequest) => `${appBase(req)}/api/auth/google/callback`;
  const oauthCookie = (req: FastifyRequest, value: string, maxAge: number) =>
    `${OAUTH_COOKIE}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${req.protocol === "https" ? "; Secure" : ""}`;

  /** Server to server: the code becomes a profile only Google can vouch for. */
  async function googleProfile(code: string, redirectUri: string): Promise<GoogleProfile> {
    const signal = AbortSignal.timeout(10_000);
    const token = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: google!.clientId, client_secret: google!.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(),
      signal,
    });
    if (!token.ok) throw new Error(`token ${token.status}`);
    const { access_token } = (await token.json()) as { access_token?: string };
    const info = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` }, signal });
    if (!info.ok) throw new Error(`userinfo ${info.status}`);
    return (await info.json()) as GoogleProfile;
  }

  app.get("/api/auth/google/start", async (req, reply) => {
    if (!accounts || !google) return reply.redirect("/#/signup");
    const state = randomBytes(24).toString("base64url");
    reply.header("set-cookie", oauthCookie(req, state, 600));
    const q = new URLSearchParams({
      client_id: google.clientId, redirect_uri: googleRedirect(req), response_type: "code", scope: "openid email profile", state, prompt: "select_account",
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/api/auth/google/callback", async (req, reply) => {
    if (!accounts || !google) return reply.redirect("/#/signup");
    const expected = readCookie(req.headers.cookie, OAUTH_COOKIE);
    reply.header("set-cookie", oauthCookie(req, "", 0));
    const fail = (code: string) => reply.redirect(`/#/auth-error/${code}`);
    if (req.query.error) return fail("cancelled");
    // The state proves this answer belongs to a sign-in started from this browser.
    if (!expected || !req.query.code || !sameSecret(req.query.state, expected)) return fail("expired");

    let profile: GoogleProfile;
    try {
      profile = await googleProfile(req.query.code, googleRedirect(req));
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, "Google sign-in failed");
      return fail("google");
    }
    if (!profile.email || profile.email_verified !== true) return fail("unverified");

    const email = normalizeEmail(profile.email);
    const existing = getUserByEmail(db, email);
    const t = now();
    let userId: number;
    if (existing) {
      if (!existing.email_verified) {
        // Someone signed up with this address without owning it: its real owner takes the account back.
        tx(db, () => {
          run(db, "UPDATE users SET password_hash = '', email_verified = 1 WHERE id = ?", existing.id);
          endAllSessions(db, existing.id);
        });
      }
      userId = existing.id;
    } else {
      if (!signupOpen()) return fail("no-account");
      if (!signupByIp(req.ip, t) || !signupsPerDay("all", t)) return fail("busy");
      const name = (profile.name?.trim() || email.split("@")[0]).slice(0, 80);
      userId = tx(db, () => {
        const id = createUser(db, { email, name, passwordHash: "" }, t);
        const w = createWorkspace(db, tr(`${name}'s workspace`, `Espace de ${name}`), t);
        addMember(db, id, w.id, "owner", t);
        logActivity(db, name, tr(`${name} created the workspace.`, `${name} a créé l'espace.`), null, t, w.id);
        return id;
      });
      notify(tr(`New sign-up with Google: ${name}, ${email}`, `Nouvelle inscription avec Google : ${name}, ${email}`));
    }
    startSession(req, reply, userId);
    notifyChange();
    return reply.redirect("/#/brief");
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) endSession(db, token);
    reply.header("set-cookie", sessionCookie("", req.protocol === "https", 0));
    return { ok: true };
  });

  // ---------- Invitation and reset links ----------

  const linkOr404 = (token: string) => {
    const link = linkByToken(db, token, now());
    if (!link) throw httpError(404, tr("This link is invalid, already used or expired.", "Ce lien n'est plus valable : déjà utilisé ou expiré."));
    return link;
  };

  app.get<{ Params: { token: string } }>("/api/auth/link/:token", async (req) => {
    const link = linkOr404(req.params.token);
    return {
      kind: link.kind,
      email: link.email,
      role: link.role,
      workspace_id: link.workspace_id,
      workspace: link.workspace_id ? getWorkspace(db, link.workspace_id)?.name ?? null : null,
      account_exists: !!getUserByEmail(db, link.email),
      // Already signed in as the invited person (e.g. with Google): one click joins.
      signed_in: !!link.email && caller(req)?.email === link.email && caller(req)!.id > 0,
      min_password: MIN_PASSWORD,
    };
  });

  app.post<{ Params: { token: string }; Body: { name?: string; password?: string } }>(
    "/api/auth/link/:token",
    body({ name: NAME, password: PASSWORD }, []),
    async (req, reply) => {
      const link = linkOr404(req.params.token);
      const existing = getUserByEmail(db, link.email);
      const t = now();
      let userId: number;

      if (link.kind === "reset") {
        if (!existing) throw httpError(404, tr("No account uses this email.", "Aucun compte n'utilise cet e-mail."));
        const problem = passwordProblem(req.body.password ?? "");
        if (problem) throw httpError(400, problem);
        const hash = await hashPassword(req.body.password!);
        tx(db, () => {
          run(db, "UPDATE users SET password_hash = ? WHERE id = ?", hash, existing.id);
          endAllSessions(db, existing.id);
          markLinkUsed(db, link.id, t);
        });
        userId = existing.id;
      } else if (existing) {
        // Already has an account (e.g. an agency member invited to one more client): prove it's them.
        const signedIn = caller(req)?.id === existing.id;
        if (!signedIn && !(req.body.password && (await verifyPassword(req.body.password, existing.password_hash)))) {
          throw httpError(401, tr("Wrong password for this account.", "Mot de passe incorrect pour ce compte."));
        }
        tx(db, () => {
          addMember(db, existing.id, link.workspace_id!, link.role ?? "member", t);
          markLinkUsed(db, link.id, t);
          logActivity(db, existing.name, tr(`${existing.name} joined the workspace.`, `${existing.name} a rejoint l'espace.`), null, t, link.workspace_id!);
        });
        userId = existing.id;
      } else {
        const name = req.body.name?.trim();
        if (!name) throw httpError(400, tr("Please enter your name.", "Indiquez votre nom."));
        const problem = passwordProblem(req.body.password ?? "");
        if (problem) throw httpError(400, problem);
        const hash = await hashPassword(req.body.password!);
        userId = tx(db, () => {
          const id = createUser(db, { email: link.email, name, passwordHash: hash }, t);
          addMember(db, id, link.workspace_id!, link.role ?? "member", t);
          markLinkUsed(db, link.id, t);
          logActivity(db, name, tr(`${name} joined the workspace.`, `${name} a rejoint l'espace.`), null, t, link.workspace_id!);
          return id;
        });
      }
      startSession(req, reply, userId);
      notifyChange();
      const u = getUser(db, userId)!;
      return me({ id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin });
    },
  );

  // ---------- The signed-in person ----------

  app.register(async (personal) => {
    personal.addHook("onRequest", requireUser);

    personal.get("/api/me", async (req) => me(req.ctx.user));

    personal.post<{ Body: { current: string; next: string } }>(
      "/api/me/password",
      body({ current: PASSWORD, next: PASSWORD }, ["current", "next"]),
      async (req) => {
        const u = req.ctx.user.id ? getUser(db, req.ctx.user.id) : undefined;
        if (!u) throw httpError(400, tr("This session has no password to change.", "Cette session n'a pas de mot de passe à changer."));
        if (!(await verifyPassword(req.body.current, u.password_hash))) throw httpError(401, tr("Your current password is wrong.", "Votre mot de passe actuel est incorrect."));
        const problem = passwordProblem(req.body.next);
        if (problem) throw httpError(400, problem);
        run(db, "UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(req.body.next), u.id);
        return { message: tr("Password changed.", "Mot de passe modifié.") };
      },
    );

    // Anyone signed in can open a workspace (an agency opens one per client); they become its owner.
    personal.post<{ Body: { name: string } }>("/api/workspaces", body({ name: NAME }, ["name"]), async (req, reply) => {
      const t = now();
      const w = tx(db, () => {
        const created = createWorkspace(db, req.body.name, t);
        if (req.ctx.user.id) addMember(db, req.ctx.user.id, created.id, "owner", t);
        logActivity(db, req.ctx.actor, tr(`Workspace “${created.name}” created.`, `Espace « ${created.name} » créé.`), null, t, created.id);
        return created;
      });
      return reply.code(201).send({ id: w.id, name: w.name, role: "owner" });
    });
  });

  // ---------- The current workspace and its members ----------

  app.register(async (team) => {
    team.addHook("onRequest", requireWorkspace);

    team.get("/api/workspace", async (req) => ({
      id: req.ctx.ws,
      name: req.ctx.wsName,
      role: req.ctx.role,
      you: req.ctx.user.id,
      members: members(db, req.ctx.ws),
      invites: req.ctx.role === "owner" ? pendingInvites(db, req.ctx.ws, now()) : [],
    }));

    team.patch<{ Body: { name: string } }>("/api/workspace", body({ name: NAME }, ["name"]), async (req) => {
      need(req, "owner");
      run(db, "UPDATE workspaces SET name = ? WHERE id = ?", req.body.name.trim(), req.ctx.ws);
      notifyChange();
      return { message: tr("Workspace renamed.", "Espace renommé.") };
    });

    team.post<{ Body: { email: string; role: Role } }>("/api/workspace/invites", body({ email: EMAIL, role: ROLE }, ["email", "role"]), async (req, reply) => {
      need(req, "owner");
      const existing = getUserByEmail(db, req.body.email);
      if (existing && roleIn(db, existing.id, req.ctx.ws)) throw httpError(409, tr("This person is already in the workspace.", "Cette personne fait déjà partie de l'espace."));
      const t = now();
      const token = createLink(db, { kind: "invite", email: req.body.email, workspaceId: req.ctx.ws, role: req.body.role, createdBy: req.ctx.user.id || null }, t);
      logActivity(db, req.ctx.actor, tr(`Invitation created for ${req.body.email.trim()}.`, `Invitation créée pour ${req.body.email.trim()}.`), null, t, req.ctx.ws);
      notifyChange();
      return reply.code(201).send({ link: linkUrl(req, token), email: normalizeEmail(req.body.email), role: req.body.role });
    });

    team.delete<{ Params: { id: string } }>("/api/workspace/invites/:id", async (req) => {
      need(req, "owner");
      if (!revokeInvite(db, req.ctx.ws, Number(req.params.id))) throw httpError(404, tr("Invitation not found.", "Invitation introuvable."));
      return { message: tr("Invitation cancelled.", "Invitation annulée.") };
    });

    const memberOr404 = (req: FastifyRequest, userId: number) => {
      const role = roleIn(db, userId, req.ctx.ws);
      if (!role) throw httpError(404, tr("Member not found.", "Membre introuvable."));
      return role;
    };
    const lastOwner = () => httpError(409, tr("A workspace needs at least one owner.", "Un espace doit garder au moins un propriétaire."));

    team.patch<{ Params: { userId: string }; Body: { role: Role } }>("/api/workspace/members/:userId", body({ role: ROLE }, ["role"]), async (req) => {
      need(req, "owner");
      const userId = Number(req.params.userId);
      const current = memberOr404(req, userId);
      if (current === "owner" && req.body.role !== "owner" && ownerCount(db, req.ctx.ws) <= 1) throw lastOwner();
      run(db, "UPDATE memberships SET role = ? WHERE user_id = ? AND workspace_id = ?", req.body.role, userId, req.ctx.ws);
      notifyChange();
      return { message: tr("Role updated.", "Rôle modifié.") };
    });

    team.delete<{ Params: { userId: string } }>("/api/workspace/members/:userId", async (req) => {
      const userId = Number(req.params.userId);
      if (userId !== req.ctx.user.id) need(req, "owner");
      const current = memberOr404(req, userId);
      if (current === "owner" && ownerCount(db, req.ctx.ws) <= 1) throw lastOwner();
      const name = getUser(db, userId)?.name ?? "";
      tx(db, () => {
        run(db, "DELETE FROM memberships WHERE user_id = ? AND workspace_id = ?", userId, req.ctx.ws);
        logActivity(db, req.ctx.actor, tr(`${name} no longer has access to the workspace.`, `${name} n'a plus accès à l'espace.`), null, now(), req.ctx.ws);
      });
      notifyChange();
      return { message: tr("Access removed.", "Accès retiré.") };
    });
  });

  // ---------- Platform administrator ----------

  app.register(async (platform) => {
    platform.addHook("onRequest", requireAdmin);

    platform.get("/api/admin/workspaces", async () =>
      all<{ id: string; name: string; created_at: number; members: number; agents: number; owners: string | null }>(
        db,
        `SELECT w.id, w.name, w.created_at,
                (SELECT COUNT(*) FROM memberships m WHERE m.workspace_id = w.id) members,
                (SELECT COUNT(*) FROM agents a WHERE a.workspace_id = w.id) agents,
                (SELECT GROUP_CONCAT(u.email, ', ') FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = w.id AND m.role = 'owner') owners
         FROM workspaces w ORDER BY w.id = 'main' DESC, w.created_at`,
      ),
    );

    // No email is sent: the administrator passes the reset link on.
    platform.post<{ Body: { email: string } }>("/api/admin/reset-link", body({ email: EMAIL }, ["email"]), async (req) => {
      const user = getUserByEmail(db, req.body.email);
      if (!user) throw httpError(404, tr("No account uses this email.", "Aucun compte n'utilise cet e-mail."));
      const token = createLink(db, { kind: "reset", email: user.email, createdBy: req.ctx.user.id || null }, now());
      return { link: linkUrl(req, token) };
    });
  });
}
