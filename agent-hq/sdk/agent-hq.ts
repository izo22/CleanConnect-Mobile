/**
 * Agent HQ SDK — connects any agent (n8n code node, Claude Agent SDK,
 * OpenAI Agents, a cron script…) to Agent HQ. No dependencies, works in
 * Node 18+, Deno, Bun and edge runtimes.
 *
 *   const hq = new AgentHQ({ url: "https://hq.example.com", key: process.env.AGENT_HQ_KEY! });
 *   await hq.guard({ action: "stripe.refund", amount_cents: 34000, summary: "Rembourser 340 €" },
 *                  () => stripe.refunds.create(...));
 *   await hq.report({ kind: "task", action: "zendesk.reply", cost_cents: 3, language: "fr",
 *                     input: ticket.body, output: answer });   // input/output enable AI review
 */

export interface AgentEvent {
  kind: "task" | "action" | "error";
  action?: string;
  target?: string;
  success?: boolean;
  cost_cents?: number;
  duration_ms?: number;
  language?: string;
  error_code?: string;
  error_message?: string;
  /** What the agent received (the customer's message, the request…). Used for AI review. */
  input?: string;
  /** What the agent answered or did. A sample is re-read by the AI reviewer. */
  output?: string;
  ts?: number;
  meta?: Record<string, unknown>;
}

export interface CheckRequest {
  action: string;
  amount_cents?: number;
  target?: string;
  summary?: string;
  context?: string;
  sensitive?: boolean;
  payload?: unknown;
}

export type CheckResult =
  | { decision: "allow" }
  | { decision: "deny"; reason: string }
  | { decision: "needs_approval"; reason: string; approval_id: number };

export interface Control {
  agent_id: string;
  name: string;
  paused: boolean;
  pause_reason: string | null;
  autonomy: 0 | 1 | 2;
  model_tier: string;
  prompt: { version: number; content: string } | null;
}

export class ActionRefused extends Error {
  constructor(public reason: string) {
    super(`Agent HQ a refusé l'action : ${reason}`);
  }
}

export class AgentHQ {
  private url: string;
  private key: string;

  constructor(opts: { url: string; key: string }) {
    this.url = opts.url.replace(/\/$/, "");
    this.key = opts.key;
  }

  private async call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(this.url + path, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${this.key}`, ...(init?.body ? { "content-type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(`Agent HQ ${res.status} : ${data.error ?? res.statusText}`);
    return data as T;
  }

  /** Sends one or more events. Returns the latest control state (paused, prompt…). */
  report(events: AgentEvent | AgentEvent[]) {
    const body = Array.isArray(events) ? { events } : events;
    return this.call<{ accepted: number; control: Control }>("/api/v1/events", { method: "POST", body });
  }

  /** Current settings decided by humans: pause, trust level, active prompt, model tier. */
  config() {
    return this.call<Control>("/api/v1/config");
  }

  /** Asks whether an action is allowed, without waiting for a human. */
  check(req: CheckRequest) {
    return this.call<CheckResult>("/api/v1/check", { method: "POST", body: req });
  }

  /** Waits until a human approves or rejects. Resolves true if approved. */
  async waitForApproval(id: number, { timeoutMs = 24 * 3600_000, intervalMs = 5000 } = {}): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { status } = await this.call<{ status: string }>(`/api/v1/approvals/${id}`);
      if (status !== "pending") return status === "approved";
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  /**
   * Runs `fn` only if Agent HQ allows it (waiting for a human when needed),
   * then reports the outcome. Throws ActionRefused when refused.
   */
  async guard<T>(req: CheckRequest, fn: () => Promise<T> | T, opts?: { cost_cents?: number; waitMs?: number }): Promise<T> {
    const res = await this.check(req);
    if (res.decision === "deny") throw new ActionRefused(res.reason);
    if (res.decision === "needs_approval") {
      const ok = await this.waitForApproval(res.approval_id, { timeoutMs: opts?.waitMs });
      if (!ok) throw new ActionRefused("refusée ou restée sans réponse");
    }
    const started = Date.now();
    try {
      const out = await fn();
      await this.report({ kind: "action", action: req.action, target: req.target, cost_cents: opts?.cost_cents, duration_ms: Date.now() - started });
      return out;
    } catch (err) {
      const e = err as { code?: unknown; status?: unknown; message?: string };
      await this.report({
        kind: "action", action: req.action, target: req.target, success: false, duration_ms: Date.now() - started,
        error_code: String(e.status ?? e.code ?? "error"), error_message: e.message?.slice(0, 2000),
      });
      throw err;
    }
  }
}
