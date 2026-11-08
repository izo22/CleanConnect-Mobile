import { randomUUID } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { all, get, run, tx, type DB } from "./db.ts";
import { evaluateAgent, evaluateReports } from "./engine.ts";
import { check, recordAllowed, type CheckRequest } from "./guard.ts";
import {
  DAY,
  HOUR,
  MINUTE,
  activePrompt,
  autonomyName,
  bus,
  getAgent,
  getAgentByKey,
  logActivity,
  newApiKey,
  notifyChange,
  type AgentRow,
  type AlertRow,
  type AlertSensitivity,
  type ApprovalRow,
  type RuleRow,
  ruleParams,
} from "./model.ts";
import { PlaybookError, actionsFor, applyToAgent, runPlaybook, type PlaybookId } from "./playbooks.ts";
import { notify, notifyWorkspace } from "./notify.ts";
import { describeRule, ruleDeletable } from "./rules.ts";
import { shouldSample, type Judge } from "./reviewer.ts";
import { aiPrecheck } from "./precheck.ts";
import { deliverDecision, validCallbackUrl } from "./callbacks.ts";
import { appendAudit, fullAudit, recentAudit, verifyAudit } from "./audit.ts";
import { currency, lang, tr } from "./i18n.ts";
import { N8nClient, N8nError, getIntegration, setWorkflowActive, syncIntegration, type IntegrationRow } from "./n8n.ts";
import { n8nSnippet } from "./n8n-template.ts";
import { listSteps, protectStep, undoLastProtection } from "./n8n-protect.ts";
import { PRODUCT_NAME } from "./brand.ts";
import { agentStatePayload, decisionPayload, fireAgentState, fireDecision, safeOutboundUrl, subscribe, subscribeWorkspace, unsubscribe, unsubscribeWorkspace } from "./hooks.ts";
import { ZAPIER_LINKS, isZapierKey, renewZapierKey, saveZapierLinks, workspaceOfZapierKey, zapAgent, zapierLinks, zapierView, type ZapierLinks } from "./zapier.ts";
import { activity, agentDetail, agentSummaries, alertsView, approvalsView, overview, qualityView, rulesView } from "./queries.ts";
import { EARLY_ACCESS_INPUT, earlyAccessList, rateLimiter, saveEarlyAccess, type EarlyAccessIn } from "./early-access.ts";
import { httpError, makeGuards, sameSecret } from "./context.ts";
import { registerAccountRoutes } from "./account-routes.ts";

export interface AppOptions {
  db: DB;
  /** When set, people sign in with accounts; this code creates the first one (and lets scripts in via x-admin-token). */
  adminToken?: string;
  now?: () => number;
  /** true = request logs on stdout; tests pass a stream to read them. */
  logger?: boolean | { stream: { write(line: string): void } };
  /** Injected in tests to fake n8n and callback endpoints. */
  fetchImpl?: typeof fetch;
  /** Behind a reverse proxy (Caddy): trust X-Forwarded-* for protocol, host and client IP. */
  trustProxy?: boolean;
  /** Lets visitors create their own account and workspace (SIGNUP=open). */
  signup?: boolean;
  /** "Continue with Google" (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). */
  google?: { clientId: string; clientSecret: string };
  /** Reads an answer before it goes out (the AI check). Null when no AI key is set. */
  judge?: Judge | null;
}


// Content-Security-Policy: only our own scripts; Google Fonts for typography.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

interface EventIn {
  kind: "task" | "action" | "error";
  action?: string;
  target?: string;
  success?: boolean;
  cost_cents?: number;
  duration_ms?: number;
  language?: string;
  error_code?: string;
  error_message?: string;
  input?: string;
  output?: string;
  ts?: number;
  meta?: Record<string, unknown>;
}

const eventSchema = {
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { enum: ["task", "action", "error"] },
    action: { type: "string", maxLength: 200 },
    target: { type: "string", maxLength: 500 },
    success: { type: "boolean" },
    cost_cents: { type: "number", minimum: 0, maximum: 1_000_000 },
    duration_ms: { type: "integer", minimum: 0 },
    language: { type: "string", maxLength: 10 },
    error_code: { type: "string", maxLength: 100 },
    error_message: { type: "string", maxLength: 2000 },
    input: { type: "string", maxLength: 20_000 },
    output: { type: "string", maxLength: 20_000 },
    ts: { type: "integer" },
    meta: { type: "object" },
  },
} as const;

const REVIEW_INPUT = { type: "object", required: ["confirmed"], additionalProperties: false, properties: { confirmed: { type: "boolean" } } } as const;

const PLAYBOOK_IDS: PlaybookId[] = ["pause", "resume", "rollback", "handoff", "notify_owner", "autonomy0", "economy", "raise_budget"];

/** Invitation and reset links carry their secret in the path: never write it to the logs. */
const hideSecrets = (url: string) => url.replace(/(\/api\/auth\/link\/)[^/?#]+/g, "$1***");

const logOptions = (logger: AppOptions["logger"]) =>
  logger && {
    ...(logger === true ? {} : logger),
    serializers: { req: (req: { method: string; url: string; ip?: string }) => ({ method: req.method, url: hideSecrets(req.url), remoteAddress: req.ip }) },
  };

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "agent";

/** Which state the real workflow must be in after a playbook action. */
const REMOTE_STATE: Partial<Record<PlaybookId, boolean>> = { pause: false, handoff: false, resume: true, rollback: true };

export function buildApp({ db, adminToken, now = Date.now, logger = false, fetchImpl = fetch, trustProxy = false, signup = false, google, judge = null }: AppOptions) {
  const app = Fastify({ logger: logOptions(logger), bodyLimit: 2 * 1024 * 1024, trustProxy, ajv: { customOptions: { allowUnionTypes: true } } });

  app.addHook("onSend", async (req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("X-Frame-Options", "DENY");
    if (!req.url.startsWith("/api/")) reply.header("Content-Security-Policy", CSP);
    if (req.protocol === "https") reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, _req, reply) => {
    if (err instanceof PlaybookError) return reply.code(409).send({ error: err.message });
    if (err instanceof N8nError) return reply.code(502).send({ error: err.message });
    if (err.validation) return reply.code(400).send({ error: tr("Invalid request: ", "Requête invalide : ") + err.message });
    const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (code === 500) app.log.error(err);
    return reply.code(code).send({ error: code === 500 ? tr("Internal error.", "Erreur interne.") : err.message });
  });

  // ---------- Authentication ----------

  const guards = makeGuards({ db, adminToken, now });
  const { requireUser, requireAdmin, requireWorkspace, need } = guards;
  app.decorateRequest("ctx", null as unknown as FastifyRequest["ctx"]);

  // Forms posted from another site must not act with the visitor's session.
  app.addHook("onRequest", async (req, reply) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.url.startsWith("/api/")) return;
    if (req.url.startsWith("/api/v1/") || req.url.startsWith("/api/public/")) return;
    const origin = req.headers.origin;
    if (!origin) return;
    let host = "";
    try { host = new URL(origin).host; } catch { /* malformed: refused below */ }
    const forwarded = req.headers["x-forwarded-host"];
    if (host !== req.headers.host && host !== forwarded) return reply.code(403).send({ error: tr("Request refused.", "Requête refusée.") });
  });

  /**
   * Who is calling the agent API: an agent with its own key, or a Zap with the
   * workspace's Zapier key, naming its agent in the X-Agent header (an agent
   * id, or a name: an unknown name creates the agent).
   */
  const callerOf = (req: FastifyRequest, create = true): { ws: string; wsName: string | null; agent: AgentRow | null; shared: boolean } => {
    const auth = req.headers.authorization ?? "";
    const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (key && isZapierKey(key)) {
      const ws = workspaceOfZapierKey(db, key);
      if (!ws) throw Object.assign(new Error(tr("Invalid Zapier key: copy it again from Connections → Zapier.", "Clé Zapier invalide : recopiez-la depuis Connexions → Zapier.")), { statusCode: 401 });
      const header = (name: string) => {
        const v = req.headers[name];
        const raw = Array.isArray(v) ? v[0] : v;
        try { return raw ? decodeURIComponent(raw).trim() : ""; } catch { return raw?.trim() ?? ""; }
      };
      const ref = header("x-agent");
      return { ws: ws.id, wsName: ws.name, agent: ref ? zapAgent(db, ws.id, ref, header("x-zap-id") || null, now(), create) : null, shared: true };
    }
    const agent = key ? getAgentByKey(db, key) : undefined;
    if (!agent) throw Object.assign(new Error(tr("Invalid agent key.", "Clé d'agent invalide.")), { statusCode: 401 });
    return { ws: agent.workspace_id, wsName: null, agent, shared: false };
  };

  const agentOf = (req: FastifyRequest): AgentRow => {
    const caller = callerOf(req);
    if (!caller.agent) throw Object.assign(new Error(tr("Choose the agent (the Zap) in the “Agent” field of this Orvanta step.", "Choisissez l'agent (le Zap) dans le champ « Agent » de cette étape Orvanta.")), { statusCode: 400 });
    return caller.agent;
  };

  const notFound = (en: string, fr: string) => Object.assign(new Error(tr(`${en} not found.`, `${fr} introuvable.`)), { statusCode: 404 });

  const control = (agent: AgentRow) => {
    const fresh = getAgent(db, agent.id)!;
    const prompt = activePrompt(db, agent.id);
    return {
      agent_id: fresh.id,
      name: fresh.name,
      paused: !!fresh.paused,
      pause_reason: fresh.pause_reason,
      autonomy: fresh.autonomy,
      model_tier: fresh.model_tier,
      prompt: prompt ? { version: prompt.version, content: prompt.content } : null,
    };
  };

  // Used by Docker and the host to know the service is alive (database included).
  app.get("/api/health", async (_req, reply) => {
    try {
      db.prepare("SELECT 1").get();
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false });
    }
  });

  // Language and currency of this instance, needed before signing in.
  app.get("/api/locale", async () => ({ language: lang(), currency: currency() }));

  // ---------- Public site: "Request early access" form ----------

  const earlyAccessAllowed = rateLimiter(5, HOUR);
  app.post<{ Body: EarlyAccessIn }>("/api/public/early-access", { schema: { body: EARLY_ACCESS_INPUT } }, async (req, reply) => {
    const b = req.body;
    // Bots fill in every field, including the one hidden from people: pretend it worked.
    if (b.website) return reply.code(201).send({ ok: true });
    if (!earlyAccessAllowed(req.ip, now())) {
      return reply.code(429).send({ error: tr("Too many requests. Please try again in an hour.", "Trop de demandes. Réessayez dans une heure.") });
    }
    if (b.kind === "contact" && !b.message?.trim()) {
      return reply.code(400).send({ error: tr("Please write your message.", "Écrivez votre message.") });
    }
    saveEarlyAccess(db, b, now());
    const who = `${b.name.trim()}${b.company?.trim() ? ` (${b.company.trim()})` : ""}, ${b.email.trim()}`;
    if (b.kind === "contact") {
      const msg = b.message!.trim();
      notify(tr(`New contact message from ${who}${b.role ? ` · ${b.role}` : ""}: ${msg.slice(0, 300)}`, `Nouveau message de contact de ${who}${b.role ? ` · ${b.role}` : ""} : ${msg.slice(0, 300)}`));
    } else {
      notify(tr(`New setup call request: ${who}`, `Nouvelle demande d'appel : ${who}`));
    }
    notifyChange();
    return reply.code(201).send({ ok: true });
  });

  // ---------- Agent-facing API (used by the SDK) ----------

  app.post<{ Body: EventIn | { events: EventIn[] } }>(
    "/api/v1/events",
    {
      schema: {
        body: {
          oneOf: [
            eventSchema,
            { type: "object", required: ["events"], additionalProperties: false, properties: { events: { type: "array", maxItems: 500, items: eventSchema } } },
          ],
        },
      },
    },
    async (req) => {
      const agent = agentOf(req);
      const wasPaused = agent.paused;
      const list = "events" in req.body ? req.body.events : [req.body];
      const t = now();
      const stmt = db.prepare(
        `INSERT INTO events (agent_id, ts, kind, action, target, success, cost_cents, duration_ms, language, error_code, error_message, meta, input, output, review_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      tx(db, () => {
        for (const e of list) {
          const ts = e.ts && e.ts > t - 7 * DAY && e.ts < t + 5 * MINUTE ? e.ts : t;
          const success = e.kind === "error" ? false : e.success ?? true;
          stmt.run(
            agent.id, ts, e.kind, e.action ?? null, e.target ?? null, success ? 1 : 0, e.cost_cents ?? 0,
            e.duration_ms ?? null, e.language ?? null, e.error_code ?? null, e.error_message ?? null,
            e.meta ? JSON.stringify(e.meta) : null, e.input ?? null, e.output ?? null,
            shouldSample(agent, !!e.output) ? "pending" : null,
          );
        }
        evaluateAgent(db, agent.id, t);
      });
      notifyChange();
      // A guardrail may just have paused this agent: tell subscribed platforms.
      if (getAgent(db, agent.id)!.paused !== wasPaused) void fireAgentState(db, agent.id, fetchImpl);
      return { accepted: list.length, control: control(agent) };
    },
  );

  app.post<{ Body: CheckRequest }>(
    "/api/v1/check",
    {
      schema: {
        body: {
          type: "object",
          required: ["action"],
          additionalProperties: false,
          properties: {
            action: { type: "string", minLength: 1, maxLength: 200 },
            amount_cents: { type: "integer", minimum: 0 },
            target: { type: "string", maxLength: 500 },
            summary: { type: "string", maxLength: 300 },
            context: { type: "string", maxLength: 3000 },
            sensitive: { type: "boolean" },
            payload: {},
            callback_url: { type: "string", maxLength: 2000 },
            input: { type: "string", maxLength: 20_000 },
            output: { type: "string", maxLength: 20_000 },
            require_approval: { type: "boolean" },
          },
        },
      },
    },
    async (req) => {
      const agent = agentOf(req);
      const cb = req.body.callback_url;
      if (cb !== undefined) {
        if (!validCallbackUrl(cb)) throw Object.assign(new Error(tr("callback_url must be an http(s) address.", "callback_url doit être une adresse http(s).")), { statusCode: 400 });
        // An n8n agent may only be called back on its own n8n server.
        const integration = agent.integration_id ? getIntegration(db, agent.integration_id) : undefined;
        if (integration && new URL(cb).hostname !== new URL(integration.base_url).hostname) {
          throw Object.assign(new Error(tr("callback_url must point to the connected n8n server.", "callback_url doit pointer vers le serveur n8n connecté.")), { statusCode: 400 });
        }
        if (!integration && !safeOutboundUrl(cb)) throw Object.assign(new Error(tr("callback_url must be a public https address.", "callback_url doit être une adresse https publique.")), { statusCode: 400 });
      }
      let result = tx(db, () => check(db, agent, req.body, now()));
      // The guardrails allowed it: if the agent sent its answer, the AI reads it before it goes out.
      if (result.decision === "allow" && judge) result = (await aiPrecheck(db, agent, req.body, judge, now())) ?? result;
      if (result.decision === "allow") recordAllowed(db, agent, req.body, now());
      // Every permission check, whatever the answer, goes into the tamper-evident record.
      {
        const b = req.body;
        const r = result as { reason?: string; approval_id?: number; rule_id?: string };
        if (r.approval_id && r.rule_id) run(db, "UPDATE approvals SET rule_id = ? WHERE id = ?", r.rule_id, r.approval_id);
        const verdict = result.decision === "allow"
          ? tr("allowed", "autorisé")
          : result.decision === "needs_approval" ? tr("waiting for a human decision", "en attente d'une décision humaine") : tr("refused", "refusé");
        appendAudit(db, agent.workspace_id, {
          ts: now(), kind: "check", actor: agent.name, agentId: agent.id,
          summary: tr(`Asked permission: ${b.summary || b.action} → ${verdict}`, `Demande de permission : ${b.summary || b.action} → ${verdict}`)
            + (r.reason ? ` (${r.reason})` : ""),
          data: { action: b.action, amount_cents: b.amount_cents ?? null, target: b.target ?? null, decision: result.decision, reason: r.reason ?? null, approval_id: r.approval_id ?? null },
        });
      }
      if (result.decision !== "allow") notifyChange();
      if (result.decision === "needs_approval") {
        const a = get<{ title: string; reason: string }>(db, "SELECT title, reason FROM approvals WHERE id = ?", result.approval_id);
        if (a) notifyWorkspace(db, agent.workspace_id, tr(`⏳ ${agent.name} is waiting for your approval: ${a.title} (${a.reason})`, `⏳ ${agent.name} attend votre validation : ${a.title} (${a.reason})`), { path: "/#/decisions" });
      }
      // Plain booleans make no-code filters ("only continue if allowed") easy.
      return { ...result, allowed: result.decision === "allow", needs_approval: result.decision === "needs_approval" };
    },
  );

  app.get<{ Params: { id: string } }>("/api/v1/approvals/:id", async (req) => {
    const agent = agentOf(req);
    const a = get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ? AND agent_id = ?", Number(req.params.id), agent.id);
    if (!a) throw notFound("Request", "Demande");
    // The text to use: the approver's corrected version when they edited it, else the agent's draft.
    return {
      id: a.id, status: a.status, decided_by: a.decided_by, decided_at: a.decided_at,
      action: a.action, title: a.title,
      output: a.edited_output ?? a.output ?? null, edited: a.edited_output != null,
    };
  });

  app.get("/api/v1/config", async (req) => {
    const caller = callerOf(req, false);
    // Zapier tests a workspace connection without an agent: name the connection after the workspace.
    if (!caller.agent) return { workspace_id: caller.ws, name: `${PRODUCT_NAME} · ${caller.wsName}`, workspace: true };
    return control(caller.agent);
  });

  /** The agents a Zap can say it is (Zapier's "Agent" list). */
  app.get("/api/v1/agents", async (req) => {
    const caller = callerOf(req, false);
    if (!caller.shared && caller.agent) return [{ id: caller.agent.id, name: caller.agent.name }];
    return all<{ id: string; name: string }>(db, "SELECT id, name FROM agents WHERE workspace_id = ? ORDER BY name", caller.ws);
  });

  /**
   * Zapier's "Ask Permission" waits for the decision: it gives the address at
   * which Zapier resumes the Zap, called as soon as a human decides.
   */
  app.post<{ Params: { id: string }; Body: { callback_url: string } }>(
    "/api/v1/approvals/:id/callback",
    { schema: { body: { type: "object", required: ["callback_url"], additionalProperties: false, properties: { callback_url: { type: "string", minLength: 8, maxLength: 2000 } } } } },
    async (req) => {
      const caller = callerOf(req);
      const a = get<ApprovalRow & { workspace_id: string }>(
        db, "SELECT ap.*, ag.workspace_id FROM approvals ap JOIN agents ag ON ag.id = ap.agent_id WHERE ap.id = ?", Number(req.params.id),
      );
      if (!a || a.workspace_id !== caller.ws || (caller.agent && !caller.shared && a.agent_id !== caller.agent.id)) throw notFound("Request", "Demande");
      if (!safeOutboundUrl(req.body.callback_url)) throw Object.assign(new Error(tr("callback_url must be a public https address.", "callback_url doit être une adresse https publique.")), { statusCode: 400 });
      run(db, "UPDATE approvals SET callback_url = ?, callback_status = NULL WHERE id = ?", req.body.callback_url, a.id);
      // Decided in the meantime: wake the Zap up right away.
      if (a.status !== "pending") void deliverDecision(db, a.id, fetchImpl).then(() => notifyChange());
      return { ok: true };
    },
  );

  // ---------- REST hooks (Zapier) ----------

  app.post<{ Body: { event: "decision" | "agent_state"; target_url: string; filter?: Record<string, unknown> } }>(
    "/api/v1/hooks",
    {
      schema: {
        body: {
          type: "object",
          required: ["event", "target_url"],
          additionalProperties: false,
          properties: {
            event: { enum: ["decision", "agent_state"] },
            target_url: { type: "string", maxLength: 2000 },
            filter: { type: "object", additionalProperties: { type: ["string", "boolean", "null"] } },
          },
        },
      },
    },
    async (req, reply) => {
      const caller = callerOf(req);
      if (!safeOutboundUrl(req.body.target_url)) throw Object.assign(new Error(tr("target_url must be a public https address.", "target_url doit être une adresse https publique.")), { statusCode: 400 });
      const filter = req.body.filter ?? null;
      // With the Zapier key and no agent chosen: about every agent of the workspace.
      const id = caller.agent
        ? subscribe(db, caller.agent.id, req.body.event, req.body.target_url, filter, now())
        : subscribeWorkspace(db, caller.ws, req.body.event, req.body.target_url, filter, now());
      return reply.code(201).send({ id });
    },
  );

  app.delete<{ Params: { id: string } }>("/api/v1/hooks/:id", async (req) => {
    const caller = callerOf(req);
    const ok = caller.shared ? unsubscribeWorkspace(db, caller.ws, Number(req.params.id)) : unsubscribe(db, caller.agent!.id, Number(req.params.id));
    if (!ok) throw notFound("Subscription", "Abonnement");
    return { ok: true };
  });

  /** Latest decisions for this agent: Zapier uses it for samples and as a polling fallback. */
  app.get<{ Querystring: { only_approved?: string; action?: string } }>("/api/v1/decisions", async (req) => {
    const caller = callerOf(req);
    const rows = caller.agent
      ? all<ApprovalRow>(db, "SELECT * FROM approvals WHERE agent_id = ? AND status != 'pending' ORDER BY decided_at DESC LIMIT 25", caller.agent.id)
      : all<ApprovalRow>(db, "SELECT ap.* FROM approvals ap JOIN agents ag ON ag.id = ap.agent_id WHERE ag.workspace_id = ? AND ap.status != 'pending' ORDER BY ap.decided_at DESC LIMIT 25", caller.ws);
    return rows
      .map((a) => decisionPayload(db, a))
      .filter((d) => req.query.only_approved !== "true" || d.approved)
      .filter((d) => !req.query.action || d.action === req.query.action);
  });

  app.get("/api/v1/agent-state", async (req) => {
    const caller = callerOf(req);
    if (caller.agent) return [agentStatePayload(db, caller.agent.id)];
    return all<{ id: string }>(db, "SELECT id FROM agents WHERE workspace_id = ? ORDER BY paused DESC, name LIMIT 25", caller.ws).map((a) => agentStatePayload(db, a.id));
  });

  // ---------- Accounts, workspaces, members ----------

  registerAccountRoutes(app, { db, adminToken, now, guards, signup, google, fetchImpl });

  app.register(async (platform) => {
    platform.addHook("onRequest", requireAdmin);
    platform.get("/api/early-access", async () => earlyAccessList(db));

    // Links every client sees on Connections → Zapier: the invite to the private app, the ready-to-copy Zaps.
    platform.get("/api/admin/zapier-links", async () => zapierLinks(db));
    platform.put<{ Body: ZapierLinks }>(
      "/api/admin/zapier-links",
      { schema: { body: { type: "object", additionalProperties: false, properties: Object.fromEntries(ZAPIER_LINKS.map((k) => [k, { type: "string", maxLength: 1000 }])) } } },
      async (req) => {
        for (const v of Object.values(req.body)) {
          if (v?.trim() && !/^https:\/\//.test(v.trim())) throw Object.assign(new Error(tr("Links must start with https://", "Les liens doivent commencer par https://")), { statusCode: 400 });
        }
        saveZapierLinks(db, req.body);
        return { message: tr("Zapier links saved.", "Liens Zapier enregistrés.") };
      },
    );
  });

  // Server-sent events: the dashboard refetches when something changes.
  app.register(async (live) => {
    live.addHook("onRequest", requireUser);
    live.get("/api/stream", (req, reply) => {
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write("retry: 3000\n\n");
      let timer: NodeJS.Timeout | null = null;
      const onChange = () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          res.write(`event: change\ndata: ${Date.now()}\n\n`);
        }, 300);
      };
      const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
      bus.on("change", onChange);
      req.raw.on("close", () => {
        bus.off("change", onChange);
        clearInterval(ping);
        if (timer) clearTimeout(timer);
      });
    });
  });

  // ---------- Dashboard API: everything inside the caller's workspace ----------

  app.register(async (admin) => {
    admin.addHook("onRequest", requireWorkspace);

    // Every id in a URL is checked against the workspace: another client's data reads as "not found".
    const agentHere = (req: FastifyRequest, id: string) => {
      const a = getAgent(db, id);
      if (!a || a.workspace_id !== req.ctx.ws) throw notFound("Agent", "Agent");
      return a;
    };
    const inWorkspace = <T>(req: FastifyRequest, table: "alerts" | "approvals" | "reviews", id: number) =>
      get<T>(db, `SELECT t.* FROM ${table} t JOIN agents a ON a.id = t.agent_id WHERE t.id = ? AND a.workspace_id = ?`, id, req.ctx.ws);
    const integrationHere = (req: FastifyRequest, id: number) => {
      const i = getIntegration(db, id);
      if (!i || i.workspace_id !== req.ctx.ws) throw notFound("Connection", "Connexion");
      return i;
    };

    admin.get("/api/overview", async (req) => overview(db, req.ctx.ws, now()));
    admin.get("/api/agents", async (req) => agentSummaries(db, req.ctx.ws, now()));
    admin.get("/api/alerts", async (req) => alertsView(db, req.ctx.ws));
    admin.get("/api/approvals", async (req) => approvalsView(db, req.ctx.ws));
    admin.get("/api/rules", async (req) => rulesView(db, req.ctx.ws));
    admin.get("/api/activity", async (req) => activity(db, req.ctx.ws, 80));
    // The tamper-evident record: the latest entries, a full check of the chain, and a download.
    admin.get<{ Querystring: { limit?: string } }>("/api/audit", async (req) => ({
      entries: recentAudit(db, req.ctx.ws, Math.min(500, Math.max(1, Number(req.query.limit) || 100))),
      check: verifyAudit(db, req.ctx.ws, now()),
    }));
    admin.get("/api/audit/verify", async (req) => verifyAudit(db, req.ctx.ws, now()));
    admin.get("/api/audit/export", async (req, reply) => {
      const check = verifyAudit(db, req.ctx.ws, now());
      const day = new Date(now()).toISOString().slice(0, 10);
      reply.header("Content-Disposition", `attachment; filename="orvanta-record-${day}.json"`);
      return {
        workspace_id: req.ctx.ws,
        exported_at: new Date(now()).toISOString(),
        how_to_verify: "Each entry's hash is SHA-256 of: previous hash + newline + JSON [workspace_id, seq, ts, kind, actor, agent_id, summary, data]. The first entry's previous hash is \"orvanta-audit-genesis\".",
        check,
        entries: fullAudit(db, req.ctx.ws),
      };
    });
    admin.get("/api/quality", async (req) => qualityView(db, req.ctx.ws, now()));

    admin.post<{ Params: { id: string }; Body: { description: string; event_id?: number } }>(
      "/api/agents/:id/reports",
      {
        schema: {
          body: {
            type: "object",
            required: ["description"],
            additionalProperties: false,
            properties: { description: { type: "string", minLength: 3, maxLength: 2000 }, event_id: { type: "integer" } },
          },
        },
      },
      async (req, reply) => {
        const agent = agentHere(req, req.params.id);
        const { description, event_id } = req.body;
        if (event_id !== undefined && !get(db, "SELECT 1 FROM events WHERE id = ? AND agent_id = ?", event_id, agent.id)) throw notFound("Exchange", "Échange");
        const t = now();
        const author = req.ctx.actor;
        tx(db, () => {
          run(db, "INSERT INTO reports (agent_id, event_id, author, description, created_at) VALUES (?, ?, ?, ?, ?)", agent.id, event_id ?? null, author, description.trim(), t);
          if (event_id !== undefined) run(db, "UPDATE reviews SET human_verdict = 'confirmed' WHERE event_id = ?", event_id);
          logActivity(db, author, tr(`Mistake reported on ${agent.name}: ${description.trim()}`, `Erreur signalée sur ${agent.name} : ${description.trim()}`), agent.id, t);
          evaluateReports(db, agent.id, t);
        });
        notifyWorkspace(db, agent.workspace_id, tr(`${author} reported a mistake by the agent “${agent.name}”: ${description.trim()}`, `${author} a signalé une erreur de l'agent « ${agent.name} » : ${description.trim()}`), { to: agent.owner_email, path: `/#/team/${encodeURIComponent(agent.id)}` });
        notifyChange();
        const owner = agent.owner_name || tr("The owner", "Le responsable");
        return reply.code(201).send({ message: tr(`Thanks, noted. ${owner} has been alerted.`, `Merci, c'est noté. ${owner} est prévenu.`) });
      },
    );

    admin.post<{ Params: { id: string }; Body: { confirmed: boolean } }>("/api/reviews/:id/verdict", { schema: { body: REVIEW_INPUT } }, async (req) => {
      need(req, "member");
      const review = inWorkspace<{ id: number; agent_id: string; summary: string }>(req, "reviews", Number(req.params.id));
      if (!review) throw notFound("Review", "Relecture");
      const t = now();
      tx(db, () => {
        run(db, "UPDATE reviews SET human_verdict = ? WHERE id = ?", req.body.confirmed ? "confirmed" : "dismissed", review.id);
        logActivity(
          db,
          req.ctx.actor,
          req.body.confirmed
            ? tr(`Mistake confirmed: ${review.summary}`, `Erreur confirmée : ${review.summary}`)
            : tr(`False alarm from the review: ${review.summary}`, `Fausse alerte de la relecture : ${review.summary}`),
          review.agent_id,
          t,
        );
        evaluateAgent(db, review.agent_id, t);
      });
      notifyChange();
      return {
        message: req.body.confirmed
          ? tr("Mistake confirmed. It counts toward the agent's quality.", "Erreur confirmée. Elle compte dans la qualité de l'agent.")
          : tr("Noted: false alarm, it no longer counts.", "Noté : fausse alerte, elle ne compte plus."),
      };
    });

    admin.get<{ Params: { id: string } }>("/api/agents/:id", async (req) => {
      const d = agentDetail(db, req.ctx.ws, req.params.id, now());
      if (!d) throw notFound("Agent", "Agent");
      // The connection key lets anyone report as this agent: viewers don't get it.
      return req.ctx.role === "viewer" ? { ...d, api_key: null } : d;
    });

    const agentBody = {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1, maxLength: 80 },
        mission: { type: "string", maxLength: 300 },
        owner_name: { type: "string", maxLength: 80 },
        owner_email: { type: "string", maxLength: 200 },
        platform: { type: "string", maxLength: 40 },
        autonomy: { type: "integer", minimum: 0, maximum: 2 },
        budget_cents: { type: "integer", minimum: 0, maximum: 100_000_000 },
        expected_language: { type: ["string", "null"], maxLength: 10 },
        access: { type: "array", maxItems: 30, items: { type: "string", maxLength: 80 } },
        minutes_per_task: { type: "number", minimum: 0, maximum: 600 },
        review_rate: { type: "number", minimum: 0, maximum: 1 },
        alert_sensitivity: { enum: ["normal", "high", "strict"] },
        prompt: { type: "string", maxLength: 50_000 },
      },
    } as const;

    type AgentBody = Partial<{
      name: string; mission: string; owner_name: string; owner_email: string; platform: string; autonomy: number;
      budget_cents: number; expected_language: string | null; access: string[]; minutes_per_task: number; prompt: string; review_rate: number;
      alert_sensitivity: AlertSensitivity;
    }>;

    admin.post<{ Body: AgentBody }>("/api/agents", { schema: { body: { ...agentBody, required: ["name"] } } }, async (req, reply) => {
      need(req, "member");
      const b = req.body;
      const t = now();
      let id = slug(b.name!);
      while (getAgent(db, id)) id = `${slug(b.name!)}-${Math.random().toString(36).slice(2, 6)}`;
      tx(db, () => {
        run(
          db,
          `INSERT INTO agents (id, workspace_id, name, mission, owner_name, owner_email, platform, autonomy, budget_cents, expected_language, access, minutes_per_task, api_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id, req.ctx.ws, b.name!, b.mission ?? "", b.owner_name ?? "", b.owner_email ?? "", b.platform ?? "custom", b.autonomy ?? 0,
          b.budget_cents ?? 10_000, b.expected_language ?? null, JSON.stringify(b.access ?? []), b.minutes_per_task ?? 3, newApiKey(), t,
        );
        if (b.prompt) run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, 1, ?, ?, 1, ?)", id, b.prompt, tr("First version", "Version initiale"), t);
        logActivity(db, req.ctx.actor, tr(`New agent on the team: ${b.name}`, `Nouvel agent dans l'équipe : ${b.name}`), id, t);
      });
      notifyChange();
      return reply.code(201).send(agentDetail(db, req.ctx.ws, id, t));
    });

    admin.patch<{ Params: { id: string }; Body: AgentBody }>("/api/agents/:id", { schema: { body: agentBody } }, async (req) => {
      need(req, "member");
      const agent = agentHere(req, req.params.id);
      const { prompt, access, ...rest } = req.body;
      const t = now();
      tx(db, () => {
        const fields: Record<string, string | number | null> = { ...rest };
        if (access) fields.access = JSON.stringify(access);
        const keys = Object.keys(fields);
        if (keys.length) {
          run(db, `UPDATE agents SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, ...keys.map((k) => fields[k]), agent.id);
        }
        if (rest.autonomy !== undefined && rest.autonomy !== agent.autonomy) {
          logActivity(db, req.ctx.actor, tr(`${agent.name}: freedom set to “${autonomyName(rest.autonomy)}”.`, `${agent.name} : liberté réglée sur « ${autonomyName(rest.autonomy)} ».`), agent.id, t);
        }
        if (rest.alert_sensitivity !== undefined && rest.alert_sensitivity !== agent.alert_sensitivity) {
          const label = { normal: tr("normal", "normale"), high: tr("alert at the first failure", "alerte au premier échec"), strict: tr("alert at the first failure, pause after 3 in a row", "alerte au premier échec, pause après 3 d'affilée") }[rest.alert_sensitivity];
          logActivity(db, req.ctx.actor, tr(`${agent.name}: failure sensitivity set to ${label}.`, `${agent.name} : sensibilité aux échecs réglée sur ${label}.`), agent.id, t);
        }
        if (rest.budget_cents !== undefined && rest.budget_cents !== agent.budget_cents) {
          logActivity(db, req.ctx.actor, tr(`${agent.name}'s budget changed.`, `Budget de ${agent.name} modifié.`), agent.id, t);
        }
        if (prompt !== undefined) {
          const last = get<{ v: number | null }>(db, "SELECT MAX(version) v FROM prompt_versions WHERE agent_id = ?", agent.id)?.v ?? 0;
          run(db, "UPDATE prompt_versions SET active = 0 WHERE agent_id = ?", agent.id);
          run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, ?, ?, ?, 1, ?)", agent.id, last + 1, prompt, tr(`Changed by ${req.ctx.actor}`, `Modifiée par ${req.ctx.actor}`), t);
          logActivity(db, req.ctx.actor, tr(`New instructions for ${agent.name} (version ${last + 1}).`, `Nouvelles consignes pour ${agent.name} (version ${last + 1}).`), agent.id, t);
        }
        evaluateAgent(db, agent.id, t);
      });
      notifyChange();
      return agentDetail(db, req.ctx.ws, agent.id, t);
    });

    admin.post<{ Params: { id: string; action: string } }>("/api/agents/:id/actions/:action", async (req) => {
      need(req, "member");
      const agent = agentHere(req, req.params.id);
      let action = req.params.action as PlaybookId;
      if (!PLAYBOOK_IDS.includes(action)) throw notFound("Action", "Action");
      if (action === "pause" && agent.paused) action = "resume";
      // Act on the real workflow first: the screen must never say "paused" while n8n runs.
      if (REMOTE_STATE[action] !== undefined) await setWorkflowActive(db, agent, REMOTE_STATE[action]!, fetchImpl);
      const message = tx(db, () => applyToAgent(db, agent, action, req.ctx.actor, now()));
      notifyChange();
      if (getAgent(db, agent.id)!.paused !== agent.paused) void fireAgentState(db, agent.id, fetchImpl);
      return { message };
    });

    admin.post<{ Params: { id: string } }>("/api/agents/:id/rotate-key", async (req) => {
      need(req, "member");
      const agent = agentHere(req, req.params.id);
      const key = newApiKey();
      run(db, "UPDATE agents SET api_key = ? WHERE id = ?", key, agent.id);
      logActivity(db, req.ctx.actor, tr(`New connection key for ${agent.name}.`, `Nouvelle clé de connexion pour ${agent.name}.`), agent.id, now());
      return { api_key: key };
    });

    admin.post<{ Params: { id: string; action: string } }>("/api/alerts/:id/actions/:action", async (req) => {
      need(req, "member");
      const action = req.params.action as PlaybookId;
      const alert = inWorkspace<AlertRow>(req, "alerts", Number(req.params.id));
      if (!alert) throw notFound("Alert", "Alerte");
      // Only touch the real workflow if Orvanta will accept the action too.
      if (alert?.status === "open" && actionsFor(db, alert).some((a) => a.id === action) && REMOTE_STATE[action] !== undefined) {
        await setWorkflowActive(db, getAgent(db, alert.agent_id)!, REMOTE_STATE[action]!, fetchImpl);
      }
      const pausedBefore = alert ? getAgent(db, alert.agent_id)?.paused : undefined;
      const message = runPlaybook(db, alert.id, action, req.ctx.actor, now());
      if (alert && getAgent(db, alert.agent_id)?.paused !== pausedBefore) void fireAgentState(db, alert.agent_id, fetchImpl);
      notifyChange();
      return { message };
    });

    admin.post<{ Params: { id: string }; Body: { approve: boolean; output?: string } }>(
      "/api/approvals/:id/decision",
      { schema: { body: { type: "object", required: ["approve"], additionalProperties: false, properties: { approve: { type: "boolean" }, output: { type: "string", minLength: 1, maxLength: 20_000 } } } } },
      async (req) => {
        const t = now();
        const message = tx(db, () => {
          const a = inWorkspace<ApprovalRow>(req, "approvals", Number(req.params.id));
          if (!a) throw notFound("Request", "Demande");
          if (a.status !== "pending") throw new PlaybookError(tr("This request has already been handled.", "Cette demande a déjà été traitée."));
          const status = req.body.approve ? "approved" : "rejected";
          // "Edit & approve": only an approval can carry a corrected text, and only when it changed something.
          const edited = req.body.approve && req.body.output !== undefined && req.body.output !== (a.output ?? "") ? req.body.output : null;
          if (req.body.output !== undefined && !req.body.approve) throw Object.assign(new Error(tr("Only an approval can carry a corrected text.", "Seule une validation peut porter un texte corrigé.")), { statusCode: 400 });
          run(db, "UPDATE approvals SET status = ?, decided_at = ?, decided_by = ?, edited_output = ? WHERE id = ?", status, t, req.ctx.actor, edited, a.id);
          const msg = !req.body.approve ? tr(`Declined: ${a.title}`, `Refusé : ${a.title}`)
            : edited !== null ? tr(`Approved with changes: ${a.title}`, `Approuvé avec modifications : ${a.title}`)
            : tr(`Approved: ${a.title}`, `Approuvé : ${a.title}`);
          logActivity(db, req.ctx.actor, msg, a.agent_id, t);
          return msg;
        });
        // Wake up the waiting workflow (n8n "Wait" node) in the background.
        void deliverDecision(db, Number(req.params.id), fetchImpl).then(() => notifyChange());
        void fireDecision(db, Number(req.params.id), fetchImpl);
        notifyChange();
        return { message };
      },
    );

    const invalid = (en: string, fr: string) => Object.assign(new Error(tr(en, fr)), { statusCode: 400 });
    /** Numbers stay positive, "agents" lists agents of this workspace, the owner's AI rules stay short. */
    const checkRuleParams = (ws: string, params: Record<string, unknown>) => {
      for (const v of Object.values(params)) {
        if (typeof v === "number" && (!Number.isFinite(v) || v < 0)) throw invalid("Invalid value.", "Valeur invalide.");
      }
      if (params.agents !== undefined) {
        const list = params.agents;
        if (!Array.isArray(list) || list.some((a) => typeof a !== "string" || !get(db, "SELECT 1 FROM agents WHERE id = ? AND workspace_id = ?", a, ws))) {
          throw invalid("Unknown agent in this rule.", "Agent inconnu dans cette règle.");
        }
      }
      if (params.text !== undefined && (typeof params.text !== "string" || !params.text.trim() || params.text.length > 500)) {
        throw invalid("Write the rule in one sentence (500 characters at most).", "Écrivez la règle en une phrase (500 caractères au plus).");
      }
    };

    // A guardrail added by the owner: a rule in their own words (checked by the AI), or "over X, I approve" / "at most X per day".
    admin.post<{ Body: { kind: "approval_amount" | "daily_total" | "written"; max_cents?: number; text?: string; agents?: string[] } }>(
      "/api/rules",
      {
        schema: {
          body: {
            type: "object", required: ["kind"], additionalProperties: false,
            properties: {
              kind: { enum: ["approval_amount", "daily_total", "written"] }, max_cents: { type: "integer", minimum: 0 },
              text: { type: "string", maxLength: 500 }, agents: { type: "array", items: { type: "string" }, maxItems: 200 },
            },
          },
        },
      },
      async (req, reply) => {
        need(req, "member");
        const b = req.body;
        const scope = b.agents?.length ? { agents: b.agents } : {};
        let params: Record<string, unknown>;
        if (b.kind === "written") params = { text: b.text?.trim() ?? "", ...scope };
        else if (b.max_cents === undefined) throw invalid("Give the amount.", "Indiquez le montant.");
        else params = { action_prefix: "*", max_cents: b.max_cents, ...scope };
        if (b.kind === "written" && !String(params.text)) throw invalid("Write the rule first.", "Écrivez d'abord la règle.");
        checkRuleParams(req.ctx.ws, params);
        const id = `${req.ctx.ws}:custom:${randomUUID().slice(0, 8)}`;
        const label = b.kind === "written" ? tr("written rule", "règle écrite") : b.kind === "daily_total" ? tr("actions with an amount", "actions avec un montant") : tr("action", "action");
        run(db, "INSERT INTO rules (id, workspace_id, kind, label, params, enabled, trigger_count, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?)",
          id, req.ctx.ws, b.kind, label, JSON.stringify(params), now());
        logActivity(db, req.ctx.actor, tr(`Rule added: ${describeRule(b.kind, label, params)}`, `Règle ajoutée : ${describeRule(b.kind, label, params)}`), null, now(), req.ctx.ws);
        notifyChange();
        return reply.code(201).send(rulesView(db, req.ctx.ws).find((r) => r.id === id));
      },
    );

    admin.delete<{ Params: { id: string } }>("/api/rules/:id", async (req) => {
      need(req, "member");
      const rule = get<RuleRow>(db, "SELECT * FROM rules WHERE id = ? AND workspace_id = ?", req.params.id, req.ctx.ws);
      if (!rule) throw notFound("Rule", "Règle");
      if (!ruleDeletable(rule)) throw invalid("The built-in rules can be turned off, not deleted.", "Les règles de base se désactivent, elles ne se suppriment pas.");
      run(db, "DELETE FROM rules WHERE id = ?", rule.id);
      logActivity(db, req.ctx.actor, tr(`Rule deleted: ${describeRule(rule.kind, rule.label, ruleParams(rule))}`, `Règle supprimée : ${describeRule(rule.kind, rule.label, ruleParams(rule))}`), null, now(), req.ctx.ws);
      notifyChange();
      return { message: tr("Rule deleted.", "Règle supprimée.") };
    });

    admin.patch<{ Params: { id: string }; Body: { enabled?: boolean; params?: Record<string, unknown>; label?: string } }>(
      "/api/rules/:id",
      {
        schema: {
          body: {
            type: "object",
            additionalProperties: false,
            properties: { enabled: { type: "boolean" }, params: { type: "object" }, label: { type: "string", minLength: 1, maxLength: 200 } },
          },
        },
      },
      async (req) => {
        need(req, "member");
        const rule = get<RuleRow>(db, "SELECT * FROM rules WHERE id = ? AND workspace_id = ?", req.params.id, req.ctx.ws);
        if (!rule) throw notFound("Rule", "Règle");
        const b = req.body;
        const params = b.params ? { ...JSON.parse(rule.params), ...b.params } : JSON.parse(rule.params);
        checkRuleParams(req.ctx.ws, params);
        const enabled = b.enabled ?? !!rule.enabled;
        const label = b.label ?? rule.label;
        run(db, "UPDATE rules SET enabled = ?, params = ?, label = ? WHERE id = ?", enabled ? 1 : 0, JSON.stringify(params), label, rule.id);
        const sentence = describeRule(rule.kind, label, params);
        if (enabled !== !!rule.enabled) {
          logActivity(db, req.ctx.actor, enabled ? tr(`Rule turned on: ${sentence}`, `Règle activée : ${sentence}`) : tr(`Rule turned off: ${sentence}`, `Règle désactivée : ${sentence}`), null, now(), req.ctx.ws);
        } else if (b.params) logActivity(db, req.ctx.actor, tr(`Rule changed: ${sentence}`, `Règle modifiée : ${sentence}`), null, now(), req.ctx.ws);
        notifyChange();
        return rulesView(db, req.ctx.ws).find((r) => r.id === rule.id);
      },
    );

    // ---------- n8n connections ----------

    const integrationView = (i: IntegrationRow) => ({
      id: i.id, kind: i.kind, name: i.name, base_url: i.base_url, last_sync_at: i.last_sync_at, last_error: i.last_error, created_at: i.created_at,
      api_key_hint: "…" + i.api_key.slice(-4),
      agents: get<{ n: number }>(db, "SELECT COUNT(*) n FROM agents WHERE integration_id = ?", i.id)?.n ?? 0,
    });

    admin.get("/api/integrations", async (req) =>
      all<IntegrationRow>(db, "SELECT * FROM integrations WHERE workspace_id = ? ORDER BY created_at", req.ctx.ws).map(integrationView),
    );

    admin.post<{ Body: { name?: string; base_url: string; api_key: string } }>(
      "/api/integrations",
      {
        schema: {
          body: {
            type: "object",
            required: ["base_url", "api_key"],
            additionalProperties: false,
            properties: { name: { type: "string", maxLength: 80 }, base_url: { type: "string", minLength: 8, maxLength: 500 }, api_key: { type: "string", minLength: 10, maxLength: 2000 } },
          },
        },
      },
      async (req, reply) => {
        need(req, "member");
        const { base_url, api_key } = req.body;
        if (!validCallbackUrl(base_url)) throw Object.assign(new Error(tr("The n8n address must start with http:// or https://", "L'adresse de n8n doit commencer par http:// ou https://")), { statusCode: 400 });
        // Test the connection before saving anything.
        const workflows = await new N8nClient(base_url, api_key, fetchImpl).listWorkflows();
        const name = req.body.name?.trim() || new URL(base_url).hostname;
        const t = now();
        const res = run(
          db,
          "INSERT INTO integrations (kind, workspace_id, name, base_url, api_key, created_at) VALUES ('n8n', ?, ?, ?, ?, ?)",
          req.ctx.ws, name, base_url.replace(/\/+$/, ""), api_key, t,
        );
        const integration = getIntegration(db, Number(res.lastInsertRowid))!;
        const result = await syncIntegration(db, integration, new N8nClient(integration.base_url, api_key, fetchImpl), t);
        logActivity(db, req.ctx.actor, tr(`Connected to n8n “${name}”: ${workflows.length} workflow(s) imported.`, `Connexion à n8n « ${name} » : ${workflows.length} workflow(s) importé(s).`), null, t, req.ctx.ws);
        return reply.code(201).send({ ...integrationView(getIntegration(db, integration.id)!), sync: result });
      },
    );

    admin.post<{ Params: { id: string } }>("/api/integrations/:id/sync", async (req) => {
      need(req, "member");
      const integration = integrationHere(req, Number(req.params.id));
      const result = await syncIntegration(db, integration, new N8nClient(integration.base_url, integration.api_key, fetchImpl), now());
      const message = tr(
        `Synced: ${result.workflows} workflow(s), ${result.imported} new execution(s).`,
        `Synchronisé : ${result.workflows} workflow(s), ${result.imported} nouvelle(s) exécution(s).`,
      );
      return { ...integrationView(getIntegration(db, integration.id)!), sync: result, message };
    });

    // A new key (e.g. with more permissions) without disconnecting: the agents and their history stay as they are.
    admin.patch<{ Params: { id: string }; Body: { api_key: string } }>(
      "/api/integrations/:id",
      { schema: { body: { type: "object", required: ["api_key"], additionalProperties: false, properties: { api_key: { type: "string", minLength: 10, maxLength: 2000 } } } } },
      async (req) => {
        need(req, "member");
        const integration = integrationHere(req, Number(req.params.id));
        await new N8nClient(integration.base_url, req.body.api_key, fetchImpl).listWorkflows();
        run(db, "UPDATE integrations SET api_key = ?, last_error = NULL WHERE id = ?", req.body.api_key, integration.id);
        logActivity(db, req.ctx.actor, tr(`New API key for n8n “${integration.name}”.`, `Nouvelle clé API pour n8n « ${integration.name} ».`), null, now(), req.ctx.ws);
        notifyChange();
        return { message: tr("Key changed and tested: the connection works.", "Clé changée et testée : la connexion fonctionne.") };
      },
    );

    // ---------- Zapier: one key for every Zap of the workspace ----------

    admin.get("/api/zapier", async (req) => {
      need(req, "member");
      return zapierView(db, req.ctx.ws);
    });

    admin.post("/api/zapier/key", async (req) => {
      need(req, "owner");
      const had = !!zapierView(db, req.ctx.ws).key;
      const key = renewZapierKey(db, req.ctx.ws);
      logActivity(db, req.ctx.actor, had
        ? tr("New Zapier key: Zaps connected with the old one must be reconnected.", "Nouvelle clé Zapier : les Zaps branchés avec l'ancienne doivent être reconnectés.")
        : tr("Zapier key created.", "Clé Zapier créée."), null, now(), req.ctx.ws);
      return {
        key,
        message: had
          ? tr("New key created. The old one no longer works: update the Orvanta connection in Zapier.", "Nouvelle clé créée. L'ancienne ne marche plus : mettez à jour la connexion Orvanta dans Zapier.")
          : tr("Zapier key created.", "Clé Zapier créée."),
      };
    });

    admin.delete<{ Params: { id: string } }>("/api/integrations/:id", async (req) => {
      need(req, "member");
      const integration = integrationHere(req, Number(req.params.id));
      tx(db, () => {
        // The agents and their history stay; they are just no longer synchronised.
        run(db, "UPDATE agents SET integration_id = NULL WHERE integration_id = ?", integration.id);
        run(db, "DELETE FROM integrations WHERE id = ?", integration.id);
      });
      notifyChange();
      return {
        message: tr(
          `Connection “${integration.name}” removed. The agents and their history are kept.`,
          `Connexion « ${integration.name} » supprimée. Les agents et leur historique sont conservés.`,
        ),
      };
    });

    admin.get<{ Params: { id: string } }>("/api/agents/:id/n8n-snippet", async (req) => {
      need(req, "member");
      const agent = agentHere(req, req.params.id);
      const host = `${req.protocol}://${req.headers.host}`;
      return n8nSnippet(process.env.PUBLIC_URL ?? host, agent.api_key);
    });

    // "Protect a step": Orvanta inserts the permission check into the n8n workflow itself.
    admin.get<{ Params: { id: string } }>("/api/agents/:id/n8n/steps", async (req) => {
      need(req, "member");
      return listSteps(db, agentHere(req, req.params.id), fetchImpl);
    });

    admin.post<{ Params: { id: string }; Body: { step: string; always: boolean; amount_field?: string; max_amount?: number } }>(
      "/api/agents/:id/n8n/protect",
      {
        schema: {
          body: {
            type: "object", required: ["step", "always"], additionalProperties: false,
            properties: {
              step: { type: "string", minLength: 1, maxLength: 200 }, always: { type: "boolean" },
              amount_field: { type: "string", maxLength: 100 }, max_amount: { type: "number", minimum: 0, maximum: 10_000_000 },
            },
          },
        },
      },
      async (req) => {
        need(req, "member");
        const agent = agentHere(req, req.params.id);
        const orvantaUrl = process.env.PUBLIC_URL ?? `${req.protocol}://${req.headers.host}`;
        const { step, always, amount_field, max_amount } = req.body;
        const settings = { always, amountField: amount_field, maxAmountCents: max_amount === undefined ? undefined : Math.round(max_amount * 100) };
        await protectStep(db, agent, step, settings, { orvantaUrl, actor: req.ctx.actor, now: now(), fetchImpl });
        notifyChange();
        return {
          message: tr(
            `“${req.body.step}” is protected. Next time the workflow reaches it, it asks ${PRODUCT_NAME} first.`,
            `« ${req.body.step} » est protégée. La prochaine fois que le workflow y arrive, il demande d'abord à ${PRODUCT_NAME}.`,
          ),
        };
      },
    );

    admin.post<{ Params: { id: string } }>("/api/agents/:id/n8n/undo", async (req) => {
      need(req, "member");
      await undoLastProtection(db, agentHere(req, req.params.id), { actor: req.ctx.actor, now: now(), fetchImpl });
      notifyChange();
      return { message: tr("Done: the workflow is back as it was before.", "C'est fait : le workflow est revenu comme avant.") };
    });
  });

  return app;
}
