import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { all, get, run, tx, type DB } from "./db.ts";
import { evaluateAgent, evaluateReports } from "./engine.ts";
import { check, type CheckRequest } from "./guard.ts";
import {
  DAY,
  HOUR,
  MINUTE,
  activePrompt,
  bus,
  getAgent,
  getAgentByKey,
  logActivity,
  newApiKey,
  notifyChange,
  type AgentRow,
  type AlertRow,
  type ApprovalRow,
  type RuleRow,
} from "./model.ts";
import { PlaybookError, actionsFor, applyToAgent, runPlaybook, type PlaybookId } from "./playbooks.ts";
import { notify } from "./notify.ts";
import { describeRule } from "./rules.ts";
import { shouldSample } from "./reviewer.ts";
import { deliverDecision, validCallbackUrl } from "./callbacks.ts";
import { currency, lang, tr } from "./i18n.ts";
import { N8nClient, N8nError, getIntegration, setWorkflowActive, syncIntegration, type IntegrationRow } from "./n8n.ts";
import { n8nSnippet } from "./n8n-template.ts";
import { agentStatePayload, decisionPayload, fireAgentState, fireDecision, safeOutboundUrl, subscribe, unsubscribe } from "./hooks.ts";
import { activity, agentDetail, agentSummaries, alertsView, approvalsView, overview, qualityView, rulesView } from "./queries.ts";
import { EARLY_ACCESS_INPUT, earlyAccessList, rateLimiter, saveEarlyAccess, type EarlyAccessIn } from "./early-access.ts";

export interface AppOptions {
  db: DB;
  /** When set, the dashboard API requires this token (header x-admin-token or ?token=). */
  adminToken?: string;
  now?: () => number;
  /** true = request logs on stdout; tests pass a stream to read them. */
  logger?: boolean | { stream: { write(line: string): void } };
  /** Injected in tests to fake n8n and callback endpoints. */
  fetchImpl?: typeof fetch;
  /** Behind a reverse proxy (Caddy): trust X-Forwarded-* for protocol, host and client IP. */
  trustProxy?: boolean;
}

/** Comparison that takes the same time whatever the input, so the code cannot be guessed char by char. */
const sameSecret = (given: unknown, expected: string) => {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

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

/** The dashboard code can travel in ?token= (live updates): never write it to the logs. */
const hideSecrets = (url: string) => url.replace(/([?&]token=)[^&]*/g, "$1***");

const logOptions = (logger: AppOptions["logger"]) =>
  logger && {
    ...(logger === true ? {} : logger),
    serializers: { req: (req: { method: string; url: string; ip?: string }) => ({ method: req.method, url: hideSecrets(req.url), remoteAddress: req.ip }) },
  };

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "agent";

/** Which state the real workflow must be in after a playbook action. */
const REMOTE_STATE: Partial<Record<PlaybookId, boolean>> = { pause: false, handoff: false, resume: true, rollback: true };

export function buildApp({ db, adminToken, now = Date.now, logger = false, fetchImpl = fetch, trustProxy = false }: AppOptions) {
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

  const actorOf = (req: FastifyRequest) => {
    const raw = req.headers["x-user-name"];
    const name = typeof raw === "string" ? decodeURIComponent(raw).trim().slice(0, 60) : "";
    return name || tr("You", "Vous");
  };

  const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!adminToken) return;
    const q = (req.query as Record<string, string> | undefined)?.token;
    if (!sameSecret(req.headers["x-admin-token"], adminToken) && !sameSecret(q, adminToken)) {
      return reply.code(401).send({ error: tr("Access code required.", "Code d'accès requis.") });
    }
  };

  const agentOf = (req: FastifyRequest): AgentRow => {
    const auth = req.headers.authorization ?? "";
    const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const agent = key ? getAgentByKey(db, key) : undefined;
    if (!agent) throw Object.assign(new Error(tr("Invalid agent key.", "Clé d'agent invalide.")), { statusCode: 401 });
    return agent;
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
    saveEarlyAccess(db, b, now());
    const who = `${b.name.trim()}${b.company?.trim() ? ` (${b.company.trim()})` : ""}, ${b.email.trim()}`;
    notify(tr(`New early access request: ${who}`, `Nouvelle demande d'accès : ${who}`));
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
      const result = tx(db, () => check(db, agent, req.body, now()));
      if (result.decision !== "allow") notifyChange();
      // Plain booleans make no-code filters ("only continue if allowed") easy.
      return { ...result, allowed: result.decision === "allow", needs_approval: result.decision === "needs_approval" };
    },
  );

  app.get<{ Params: { id: string } }>("/api/v1/approvals/:id", async (req) => {
    const agent = agentOf(req);
    const a = get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ? AND agent_id = ?", Number(req.params.id), agent.id);
    if (!a) throw notFound("Request", "Demande");
    return { id: a.id, status: a.status, decided_by: a.decided_by, decided_at: a.decided_at };
  });

  app.get("/api/v1/config", async (req) => control(agentOf(req)));

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
      const agent = agentOf(req);
      if (!safeOutboundUrl(req.body.target_url)) throw Object.assign(new Error(tr("target_url must be a public https address.", "target_url doit être une adresse https publique.")), { statusCode: 400 });
      const id = subscribe(db, agent.id, req.body.event, req.body.target_url, req.body.filter ?? null, now());
      return reply.code(201).send({ id });
    },
  );

  app.delete<{ Params: { id: string } }>("/api/v1/hooks/:id", async (req) => {
    const agent = agentOf(req);
    if (!unsubscribe(db, agent.id, Number(req.params.id))) throw notFound("Subscription", "Abonnement");
    return { ok: true };
  });

  /** Latest decisions for this agent: Zapier uses it for samples and as a polling fallback. */
  app.get<{ Querystring: { only_approved?: string; action?: string } }>("/api/v1/decisions", async (req) => {
    const agent = agentOf(req);
    const rows = all<ApprovalRow>(db, "SELECT * FROM approvals WHERE agent_id = ? AND status != 'pending' ORDER BY decided_at DESC LIMIT 25", agent.id);
    return rows
      .map(decisionPayload)
      .filter((d) => req.query.only_approved !== "true" || d.approved)
      .filter((d) => !req.query.action || d.action === req.query.action);
  });

  app.get("/api/v1/agent-state", async (req) => [agentStatePayload(db, agentOf(req).id)]);

  // ---------- Dashboard API ----------

  app.register(async (admin) => {
    admin.addHook("onRequest", requireAdmin);

    admin.get("/api/overview", async () => overview(db, now()));
    admin.get("/api/agents", async () => agentSummaries(db, now()));
    admin.get("/api/alerts", async () => alertsView(db));
    admin.get("/api/approvals", async () => approvalsView(db));
    admin.get("/api/rules", async () => rulesView(db));
    admin.get("/api/activity", async () => activity(db, 80));
    admin.get("/api/quality", async () => qualityView(db, now()));
    admin.get("/api/early-access", async () => earlyAccessList(db));

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
        const agent = getAgent(db, req.params.id);
        if (!agent) throw notFound("Agent", "Agent");
        const { description, event_id } = req.body;
        if (event_id !== undefined && !get(db, "SELECT 1 FROM events WHERE id = ? AND agent_id = ?", event_id, agent.id)) throw notFound("Exchange", "Échange");
        const t = now();
        const author = actorOf(req);
        tx(db, () => {
          run(db, "INSERT INTO reports (agent_id, event_id, author, description, created_at) VALUES (?, ?, ?, ?, ?)", agent.id, event_id ?? null, author, description.trim(), t);
          if (event_id !== undefined) run(db, "UPDATE reviews SET human_verdict = 'confirmed' WHERE event_id = ?", event_id);
          logActivity(db, author, tr(`Mistake reported on ${agent.name}: ${description.trim()}`, `Erreur signalée sur ${agent.name} : ${description.trim()}`), agent.id, t);
          evaluateReports(db, agent.id, t);
        });
        notify(tr(`${author} reported a mistake by the agent “${agent.name}”: ${description.trim()}`, `${author} a signalé une erreur de l'agent « ${agent.name} » : ${description.trim()}`), agent.owner_email);
        notifyChange();
        const owner = agent.owner_name || tr("The owner", "Le responsable");
        return reply.code(201).send({ message: tr(`Thanks, noted. ${owner} has been alerted.`, `Merci, c'est noté. ${owner} est prévenu.`) });
      },
    );

    admin.post<{ Params: { id: string }; Body: { confirmed: boolean } }>("/api/reviews/:id/verdict", { schema: { body: REVIEW_INPUT } }, async (req) => {
      const review = get<{ id: number; agent_id: string; summary: string }>(db, "SELECT id, agent_id, summary FROM reviews WHERE id = ?", Number(req.params.id));
      if (!review) throw notFound("Review", "Relecture");
      const t = now();
      tx(db, () => {
        run(db, "UPDATE reviews SET human_verdict = ? WHERE id = ?", req.body.confirmed ? "confirmed" : "dismissed", review.id);
        logActivity(
          db,
          actorOf(req),
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
      const d = agentDetail(db, req.params.id, now());
      if (!d) throw notFound("Agent", "Agent");
      return d;
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
        prompt: { type: "string", maxLength: 50_000 },
      },
    } as const;

    type AgentBody = Partial<{
      name: string; mission: string; owner_name: string; owner_email: string; platform: string; autonomy: number;
      budget_cents: number; expected_language: string | null; access: string[]; minutes_per_task: number; prompt: string; review_rate: number;
    }>;

    admin.post<{ Body: AgentBody }>("/api/agents", { schema: { body: { ...agentBody, required: ["name"] } } }, async (req, reply) => {
      const b = req.body;
      const t = now();
      let id = slug(b.name!);
      while (getAgent(db, id)) id = `${slug(b.name!)}-${Math.random().toString(36).slice(2, 6)}`;
      tx(db, () => {
        run(
          db,
          `INSERT INTO agents (id, name, mission, owner_name, owner_email, platform, autonomy, budget_cents, expected_language, access, minutes_per_task, api_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id, b.name!, b.mission ?? "", b.owner_name ?? "", b.owner_email ?? "", b.platform ?? "custom", b.autonomy ?? 0,
          b.budget_cents ?? 10_000, b.expected_language ?? null, JSON.stringify(b.access ?? []), b.minutes_per_task ?? 3, newApiKey(), t,
        );
        if (b.prompt) run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, 1, ?, ?, 1, ?)", id, b.prompt, tr("First version", "Version initiale"), t);
        logActivity(db, actorOf(req), tr(`New agent on the team: ${b.name}`, `Nouvel agent dans l'équipe : ${b.name}`), id, t);
      });
      notifyChange();
      return reply.code(201).send(agentDetail(db, id, t));
    });

    admin.patch<{ Params: { id: string }; Body: AgentBody }>("/api/agents/:id", { schema: { body: agentBody } }, async (req) => {
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent", "Agent");
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
          logActivity(db, actorOf(req), tr(`${agent.name} moves to trust level ${rest.autonomy}.`, `${agent.name} passe au niveau de confiance ${rest.autonomy}.`), agent.id, t);
        }
        if (rest.budget_cents !== undefined && rest.budget_cents !== agent.budget_cents) {
          logActivity(db, actorOf(req), tr(`${agent.name}'s budget changed.`, `Budget de ${agent.name} modifié.`), agent.id, t);
        }
        if (prompt !== undefined) {
          const last = get<{ v: number | null }>(db, "SELECT MAX(version) v FROM prompt_versions WHERE agent_id = ?", agent.id)?.v ?? 0;
          run(db, "UPDATE prompt_versions SET active = 0 WHERE agent_id = ?", agent.id);
          run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, ?, ?, ?, 1, ?)", agent.id, last + 1, prompt, tr(`Changed by ${actorOf(req)}`, `Modifiée par ${actorOf(req)}`), t);
          logActivity(db, actorOf(req), tr(`New instructions for ${agent.name} (version ${last + 1}).`, `Nouvelles consignes pour ${agent.name} (version ${last + 1}).`), agent.id, t);
        }
        evaluateAgent(db, agent.id, t);
      });
      notifyChange();
      return agentDetail(db, agent.id, t);
    });

    admin.post<{ Params: { id: string; action: string } }>("/api/agents/:id/actions/:action", async (req) => {
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent", "Agent");
      let action = req.params.action as PlaybookId;
      if (!PLAYBOOK_IDS.includes(action)) throw notFound("Action", "Action");
      if (action === "pause" && agent.paused) action = "resume";
      // Act on the real workflow first: the screen must never say "paused" while n8n runs.
      if (REMOTE_STATE[action] !== undefined) await setWorkflowActive(db, agent, REMOTE_STATE[action]!, fetchImpl);
      const message = tx(db, () => applyToAgent(db, agent, action, actorOf(req), now()));
      notifyChange();
      if (getAgent(db, agent.id)!.paused !== agent.paused) void fireAgentState(db, agent.id, fetchImpl);
      return { message };
    });

    admin.post<{ Params: { id: string } }>("/api/agents/:id/rotate-key", async (req) => {
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent", "Agent");
      const key = newApiKey();
      run(db, "UPDATE agents SET api_key = ? WHERE id = ?", key, agent.id);
      logActivity(db, actorOf(req), tr(`New connection key for ${agent.name}.`, `Nouvelle clé de connexion pour ${agent.name}.`), agent.id, now());
      return { api_key: key };
    });

    admin.post<{ Params: { id: string; action: string } }>("/api/alerts/:id/actions/:action", async (req) => {
      const action = req.params.action as PlaybookId;
      const alert = get<AlertRow>(db, "SELECT * FROM alerts WHERE id = ?", Number(req.params.id));
      // Only touch the real workflow if Orvanta will accept the action too.
      if (alert?.status === "open" && actionsFor(db, alert).some((a) => a.id === action) && REMOTE_STATE[action] !== undefined) {
        await setWorkflowActive(db, getAgent(db, alert.agent_id)!, REMOTE_STATE[action]!, fetchImpl);
      }
      const pausedBefore = alert ? getAgent(db, alert.agent_id)?.paused : undefined;
      const message = runPlaybook(db, Number(req.params.id), action, actorOf(req), now());
      if (alert && getAgent(db, alert.agent_id)?.paused !== pausedBefore) void fireAgentState(db, alert.agent_id, fetchImpl);
      notifyChange();
      return { message };
    });

    admin.post<{ Params: { id: string }; Body: { approve: boolean } }>(
      "/api/approvals/:id/decision",
      { schema: { body: { type: "object", required: ["approve"], additionalProperties: false, properties: { approve: { type: "boolean" } } } } },
      async (req) => {
        const t = now();
        const message = tx(db, () => {
          const a = get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", Number(req.params.id));
          if (!a) throw notFound("Request", "Demande");
          if (a.status !== "pending") throw new PlaybookError(tr("This request has already been handled.", "Cette demande a déjà été traitée."));
          const status = req.body.approve ? "approved" : "rejected";
          run(db, "UPDATE approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?", status, t, actorOf(req), a.id);
          const msg = req.body.approve ? tr(`Approved: ${a.title}`, `Approuvé : ${a.title}`) : tr(`Declined: ${a.title}`, `Refusé : ${a.title}`);
          logActivity(db, actorOf(req), msg, a.agent_id, t);
          return msg;
        });
        // Wake up the waiting workflow (n8n "Wait" node) in the background.
        void deliverDecision(db, Number(req.params.id), fetchImpl).then(() => notifyChange());
        void fireDecision(db, Number(req.params.id), fetchImpl);
        notifyChange();
        return { message };
      },
    );

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
        const rule = get<RuleRow>(db, "SELECT * FROM rules WHERE id = ?", req.params.id);
        if (!rule) throw notFound("Rule", "Règle");
        const b = req.body;
        const params = b.params ? { ...JSON.parse(rule.params), ...b.params } : JSON.parse(rule.params);
        for (const v of Object.values(params)) {
          if (typeof v === "number" && (!Number.isFinite(v) || v < 0)) throw Object.assign(new Error(tr("Invalid value.", "Valeur invalide.")), { statusCode: 400 });
        }
        const enabled = b.enabled ?? !!rule.enabled;
        const label = b.label ?? rule.label;
        run(db, "UPDATE rules SET enabled = ?, params = ?, label = ? WHERE id = ?", enabled ? 1 : 0, JSON.stringify(params), label, rule.id);
        const sentence = describeRule(rule.kind, label, params);
        if (enabled !== !!rule.enabled) {
          logActivity(db, actorOf(req), enabled ? tr(`Rule turned on: ${sentence}`, `Règle activée : ${sentence}`) : tr(`Rule turned off: ${sentence}`, `Règle désactivée : ${sentence}`), null, now());
        } else if (b.params) logActivity(db, actorOf(req), tr(`Rule changed: ${sentence}`, `Règle modifiée : ${sentence}`), null, now());
        notifyChange();
        return rulesView(db).find((r) => r.id === rule.id);
      },
    );

    // ---------- n8n connections ----------

    const integrationView = (i: IntegrationRow) => ({
      id: i.id, kind: i.kind, name: i.name, base_url: i.base_url, last_sync_at: i.last_sync_at, last_error: i.last_error, created_at: i.created_at,
      api_key_hint: "…" + i.api_key.slice(-4),
      agents: get<{ n: number }>(db, "SELECT COUNT(*) n FROM agents WHERE integration_id = ?", i.id)?.n ?? 0,
    });

    admin.get("/api/integrations", async () => all<IntegrationRow>(db, "SELECT * FROM integrations ORDER BY created_at").map(integrationView));

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
        const { base_url, api_key } = req.body;
        if (!validCallbackUrl(base_url)) throw Object.assign(new Error(tr("The n8n address must start with http:// or https://", "L'adresse de n8n doit commencer par http:// ou https://")), { statusCode: 400 });
        // Test the connection before saving anything.
        const workflows = await new N8nClient(base_url, api_key, fetchImpl).listWorkflows();
        const name = req.body.name?.trim() || new URL(base_url).hostname;
        const t = now();
        const res = run(db, "INSERT INTO integrations (kind, name, base_url, api_key, created_at) VALUES ('n8n', ?, ?, ?, ?)", name, base_url.replace(/\/+$/, ""), api_key, t);
        const integration = getIntegration(db, Number(res.lastInsertRowid))!;
        const result = await syncIntegration(db, integration, new N8nClient(integration.base_url, api_key, fetchImpl), t);
        logActivity(db, actorOf(req), tr(`Connected to n8n “${name}”: ${workflows.length} workflow(s) imported.`, `Connexion à n8n « ${name} » : ${workflows.length} workflow(s) importé(s).`), null, t);
        return reply.code(201).send({ ...integrationView(getIntegration(db, integration.id)!), sync: result });
      },
    );

    admin.post<{ Params: { id: string } }>("/api/integrations/:id/sync", async (req) => {
      const integration = getIntegration(db, Number(req.params.id));
      if (!integration) throw notFound("Connection", "Connexion");
      const result = await syncIntegration(db, integration, new N8nClient(integration.base_url, integration.api_key, fetchImpl), now());
      const message = tr(
        `Synced: ${result.workflows} workflow(s), ${result.imported} new execution(s).`,
        `Synchronisé : ${result.workflows} workflow(s), ${result.imported} nouvelle(s) exécution(s).`,
      );
      return { ...integrationView(getIntegration(db, integration.id)!), sync: result, message };
    });

    admin.delete<{ Params: { id: string } }>("/api/integrations/:id", async (req) => {
      const integration = getIntegration(db, Number(req.params.id));
      if (!integration) throw notFound("Connection", "Connexion");
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
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent", "Agent");
      const host = `${req.protocol}://${req.headers.host}`;
      return n8nSnippet(process.env.PUBLIC_URL ?? host, agent.api_key);
    });

    // Server-sent events: the dashboard refetches when something changes.
    admin.get("/api/stream", (req, reply) => {
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

  return app;
}
