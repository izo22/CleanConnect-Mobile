import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { all, get, run, tx, type DB } from "./db.ts";
import { evaluateAgent, evaluateReports } from "./engine.ts";
import { check, type CheckRequest } from "./guard.ts";
import {
  DAY,
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
import { N8nClient, N8nError, getIntegration, setWorkflowActive, syncIntegration, type IntegrationRow } from "./n8n.ts";
import { n8nSnippet } from "./n8n-template.ts";
import { activity, agentDetail, agentSummaries, alertsView, approvalsView, overview, qualityView, rulesView } from "./queries.ts";

export interface AppOptions {
  db: DB;
  /** When set, the dashboard API requires this token (header x-admin-token or ?token=). */
  adminToken?: string;
  now?: () => number;
  logger?: boolean;
  /** Injected in tests to fake n8n and callback endpoints. */
  fetchImpl?: typeof fetch;
}

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

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "agent";

/** Which state the real workflow must be in after a playbook action. */
const REMOTE_STATE: Partial<Record<PlaybookId, boolean>> = { pause: false, handoff: false, resume: true, rollback: true };

export function buildApp({ db, adminToken, now = Date.now, logger = false, fetchImpl = fetch }: AppOptions) {
  const app = Fastify({ logger, bodyLimit: 2 * 1024 * 1024 });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, _req, reply) => {
    if (err instanceof PlaybookError) return reply.code(409).send({ error: err.message });
    if (err instanceof N8nError) return reply.code(502).send({ error: err.message });
    if (err.validation) return reply.code(400).send({ error: "Requête invalide : " + err.message });
    const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (code === 500) app.log.error(err);
    return reply.code(code).send({ error: code === 500 ? "Erreur interne." : err.message });
  });

  // ---------- Authentication ----------

  const actorOf = (req: FastifyRequest) => {
    const raw = req.headers["x-user-name"];
    const name = typeof raw === "string" ? decodeURIComponent(raw).trim().slice(0, 60) : "";
    return name || "Vous";
  };

  const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!adminToken) return;
    const q = (req.query as Record<string, string> | undefined)?.token;
    if (req.headers["x-admin-token"] !== adminToken && q !== adminToken) {
      return reply.code(401).send({ error: "Jeton d'accès requis." });
    }
  };

  const agentOf = (req: FastifyRequest): AgentRow => {
    const auth = req.headers.authorization ?? "";
    const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const agent = key ? getAgentByKey(db, key) : undefined;
    if (!agent) throw Object.assign(new Error("Clé d'agent invalide."), { statusCode: 401 });
    return agent;
  };

  const notFound = (what: string) => Object.assign(new Error(`${what} introuvable.`), { statusCode: 404 });

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

  app.get("/api/health", async () => ({ ok: true }));

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
        if (!validCallbackUrl(cb)) throw Object.assign(new Error("callback_url doit être une adresse http(s)."), { statusCode: 400 });
        // An n8n agent may only be called back on its own n8n server.
        const integration = agent.integration_id ? getIntegration(db, agent.integration_id) : undefined;
        if (integration && new URL(cb).hostname !== new URL(integration.base_url).hostname) {
          throw Object.assign(new Error("callback_url doit pointer vers le serveur n8n connecté."), { statusCode: 400 });
        }
      }
      const result = tx(db, () => check(db, agent, req.body, now()));
      if (result.decision !== "allow") notifyChange();
      return result;
    },
  );

  app.get<{ Params: { id: string } }>("/api/v1/approvals/:id", async (req) => {
    const agent = agentOf(req);
    const a = get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ? AND agent_id = ?", Number(req.params.id), agent.id);
    if (!a) throw notFound("Demande");
    return { id: a.id, status: a.status, decided_by: a.decided_by, decided_at: a.decided_at };
  });

  app.get("/api/v1/config", async (req) => control(agentOf(req)));

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
        if (!agent) throw notFound("Agent");
        const { description, event_id } = req.body;
        if (event_id !== undefined && !get(db, "SELECT 1 FROM events WHERE id = ? AND agent_id = ?", event_id, agent.id)) throw notFound("Échange");
        const t = now();
        const author = actorOf(req);
        tx(db, () => {
          run(db, "INSERT INTO reports (agent_id, event_id, author, description, created_at) VALUES (?, ?, ?, ?, ?)", agent.id, event_id ?? null, author, description.trim(), t);
          if (event_id !== undefined) run(db, "UPDATE reviews SET human_verdict = 'confirmed' WHERE event_id = ?", event_id);
          logActivity(db, author, `Erreur signalée sur ${agent.name} : ${description.trim()}`, agent.id, t);
          evaluateReports(db, agent.id, t);
        });
        notify(`${author} a signalé une erreur de l'agent « ${agent.name} » : ${description.trim()}`, agent.owner_email);
        notifyChange();
        return reply.code(201).send({ message: `Merci, c'est noté. ${agent.owner_name || "Le responsable"} est prévenu.` });
      },
    );

    admin.post<{ Params: { id: string }; Body: { confirmed: boolean } }>("/api/reviews/:id/verdict", { schema: { body: REVIEW_INPUT } }, async (req) => {
      const review = get<{ id: number; agent_id: string; summary: string }>(db, "SELECT id, agent_id, summary FROM reviews WHERE id = ?", Number(req.params.id));
      if (!review) throw notFound("Relecture");
      const t = now();
      tx(db, () => {
        run(db, "UPDATE reviews SET human_verdict = ? WHERE id = ?", req.body.confirmed ? "confirmed" : "dismissed", review.id);
        logActivity(db, actorOf(req), req.body.confirmed ? `Erreur confirmée : ${review.summary}` : `Fausse alerte de la relecture : ${review.summary}`, review.agent_id, t);
        evaluateAgent(db, review.agent_id, t);
      });
      notifyChange();
      return { message: req.body.confirmed ? "Erreur confirmée. Elle compte dans la qualité de l'agent." : "Noté : fausse alerte, elle ne compte plus." };
    });

    admin.get<{ Params: { id: string } }>("/api/agents/:id", async (req) => {
      const d = agentDetail(db, req.params.id, now());
      if (!d) throw notFound("Agent");
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
        if (b.prompt) run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, 1, ?, ?, 1, ?)", id, b.prompt, "Version initiale", t);
        logActivity(db, actorOf(req), `Nouvel agent dans l'équipe : ${b.name}`, id, t);
      });
      notifyChange();
      return reply.code(201).send(agentDetail(db, id, t));
    });

    admin.patch<{ Params: { id: string }; Body: AgentBody }>("/api/agents/:id", { schema: { body: agentBody } }, async (req) => {
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent");
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
          logActivity(db, actorOf(req), `${agent.name} passe au niveau de confiance ${rest.autonomy}.`, agent.id, t);
        }
        if (rest.budget_cents !== undefined && rest.budget_cents !== agent.budget_cents) {
          logActivity(db, actorOf(req), `Budget de ${agent.name} modifié.`, agent.id, t);
        }
        if (prompt !== undefined) {
          const last = get<{ v: number | null }>(db, "SELECT MAX(version) v FROM prompt_versions WHERE agent_id = ?", agent.id)?.v ?? 0;
          run(db, "UPDATE prompt_versions SET active = 0 WHERE agent_id = ?", agent.id);
          run(db, "INSERT INTO prompt_versions (agent_id, version, content, note, active, created_at) VALUES (?, ?, ?, ?, 1, ?)", agent.id, last + 1, prompt, `Modifiée par ${actorOf(req)}`, t);
          logActivity(db, actorOf(req), `Nouvelles consignes pour ${agent.name} (version ${last + 1}).`, agent.id, t);
        }
        evaluateAgent(db, agent.id, t);
      });
      notifyChange();
      return agentDetail(db, agent.id, t);
    });

    admin.post<{ Params: { id: string; action: string } }>("/api/agents/:id/actions/:action", async (req) => {
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent");
      let action = req.params.action as PlaybookId;
      if (!PLAYBOOK_IDS.includes(action)) throw notFound("Action");
      if (action === "pause" && agent.paused) action = "resume";
      // Act on the real workflow first: the screen must never say "paused" while n8n runs.
      if (REMOTE_STATE[action] !== undefined) await setWorkflowActive(db, agent, REMOTE_STATE[action]!, fetchImpl);
      const message = tx(db, () => applyToAgent(db, agent, action, actorOf(req), now()));
      notifyChange();
      return { message };
    });

    admin.post<{ Params: { id: string } }>("/api/agents/:id/rotate-key", async (req) => {
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent");
      const key = newApiKey();
      run(db, "UPDATE agents SET api_key = ? WHERE id = ?", key, agent.id);
      logActivity(db, actorOf(req), `Nouvelle clé de connexion pour ${agent.name}.`, agent.id, now());
      return { api_key: key };
    });

    admin.post<{ Params: { id: string; action: string } }>("/api/alerts/:id/actions/:action", async (req) => {
      const action = req.params.action as PlaybookId;
      const alert = get<AlertRow>(db, "SELECT * FROM alerts WHERE id = ?", Number(req.params.id));
      // Only touch the real workflow if Agent HQ will accept the action too.
      if (alert?.status === "open" && actionsFor(db, alert).some((a) => a.id === action) && REMOTE_STATE[action] !== undefined) {
        await setWorkflowActive(db, getAgent(db, alert.agent_id)!, REMOTE_STATE[action]!, fetchImpl);
      }
      const message = runPlaybook(db, Number(req.params.id), action, actorOf(req), now());
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
          if (!a) throw notFound("Demande");
          if (a.status !== "pending") throw new PlaybookError("Cette demande a déjà été traitée.");
          const status = req.body.approve ? "approved" : "rejected";
          run(db, "UPDATE approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?", status, t, actorOf(req), a.id);
          const msg = `${req.body.approve ? "Approuvé" : "Refusé"} : ${a.title}`;
          logActivity(db, actorOf(req), msg, a.agent_id, t);
          return msg;
        });
        // Wake up the waiting workflow (n8n "Wait" node) in the background.
        void deliverDecision(db, Number(req.params.id), fetchImpl).then(() => notifyChange());
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
        if (!rule) throw notFound("Règle");
        const b = req.body;
        const params = b.params ? { ...JSON.parse(rule.params), ...b.params } : JSON.parse(rule.params);
        for (const v of Object.values(params)) {
          if (typeof v === "number" && (!Number.isFinite(v) || v < 0)) throw Object.assign(new Error("Valeur invalide."), { statusCode: 400 });
        }
        const enabled = b.enabled ?? !!rule.enabled;
        const label = b.label ?? rule.label;
        run(db, "UPDATE rules SET enabled = ?, params = ?, label = ? WHERE id = ?", enabled ? 1 : 0, JSON.stringify(params), label, rule.id);
        const sentence = describeRule(rule.kind, label, params);
        if (enabled !== !!rule.enabled) logActivity(db, actorOf(req), `${enabled ? "Règle activée" : "Règle désactivée"} : ${sentence}`, null, now());
        else if (b.params) logActivity(db, actorOf(req), `Règle modifiée : ${sentence}`, null, now());
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
        if (!validCallbackUrl(base_url)) throw Object.assign(new Error("L'adresse de n8n doit commencer par http:// ou https://"), { statusCode: 400 });
        // Test the connection before saving anything.
        const workflows = await new N8nClient(base_url, api_key, fetchImpl).listWorkflows();
        const name = req.body.name?.trim() || new URL(base_url).hostname;
        const t = now();
        const res = run(db, "INSERT INTO integrations (kind, name, base_url, api_key, created_at) VALUES ('n8n', ?, ?, ?, ?)", name, base_url.replace(/\/+$/, ""), api_key, t);
        const integration = getIntegration(db, Number(res.lastInsertRowid))!;
        const result = await syncIntegration(db, integration, new N8nClient(integration.base_url, api_key, fetchImpl), t);
        logActivity(db, actorOf(req), `Connexion à n8n « ${name} » : ${workflows.length} workflow(s) importé(s).`, null, t);
        return reply.code(201).send({ ...integrationView(getIntegration(db, integration.id)!), sync: result });
      },
    );

    admin.post<{ Params: { id: string } }>("/api/integrations/:id/sync", async (req) => {
      const integration = getIntegration(db, Number(req.params.id));
      if (!integration) throw notFound("Connexion");
      const result = await syncIntegration(db, integration, new N8nClient(integration.base_url, integration.api_key, fetchImpl), now());
      return { ...integrationView(getIntegration(db, integration.id)!), sync: result, message: `Synchronisé : ${result.workflows} workflow(s), ${result.imported} nouvelle(s) exécution(s).` };
    });

    admin.delete<{ Params: { id: string } }>("/api/integrations/:id", async (req) => {
      const integration = getIntegration(db, Number(req.params.id));
      if (!integration) throw notFound("Connexion");
      tx(db, () => {
        // The agents and their history stay; they are just no longer synchronised.
        run(db, "UPDATE agents SET integration_id = NULL WHERE integration_id = ?", integration.id);
        run(db, "DELETE FROM integrations WHERE id = ?", integration.id);
      });
      notifyChange();
      return { message: `Connexion « ${integration.name} » supprimée. Les agents et leur historique sont conservés.` };
    });

    admin.get<{ Params: { id: string } }>("/api/agents/:id/n8n-snippet", async (req) => {
      const agent = getAgent(db, req.params.id);
      if (!agent) throw notFound("Agent");
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
