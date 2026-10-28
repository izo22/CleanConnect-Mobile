/**
 * AI check before the action: when an agent asks permission and sends what it
 * received and what it is about to send, Claude re-reads both first. Anything
 * doubtful waits for a human, with the reason written out, instead of being
 * noticed after the customer got it.
 */
import { tr } from "./i18n.ts";
import { requestApproval, type CheckRequest, type CheckResult } from "./guard.ts";
import { activePrompt, getRules, ruleParams, type AgentRow } from "./model.ts";
import { run, type DB } from "./db.ts";
import type { Judge, Judgement } from "./reviewer.ts";

export interface AiCheckParams {
  action_prefix: string;
  /** "doubt": hold anything doubtful or wrong; "error": hold only what is clearly wrong. */
  hold_on: "doubt" | "error";
}

/** Past this, the check counts as failed: the action waits for a human rather than going out unchecked. */
export const AI_CHECK_TIMEOUT_MS = 20_000;
const SHOWN_OUTPUT = 1500;

const matches = (action: string, prefix: string) => prefix === "*" || action.startsWith(prefix);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * Runs after the usual guardrails allowed the action. Returns the approval it
 * opened when the action must wait, or null when it may go ahead.
 */
export async function aiPrecheck(db: DB, agent: AgentRow, req: CheckRequest, judge: Judge, now: number, timeoutMs = AI_CHECK_TIMEOUT_MS): Promise<CheckResult | null> {
  if (!req.output?.trim()) return null;
  const rule = getRules(db, agent.workspace_id).find((r) => r.enabled && r.kind === "ai_check" && matches(req.action, ruleParams<AiCheckParams>(r).action_prefix));
  if (!rule) return null;
  const p = ruleParams<AiCheckParams>(rule);

  let j: Judgement | null = null;
  try {
    j = await withTimeout(
      judge({
        agentName: agent.name,
        mission: agent.mission,
        instructions: activePrompt(db, agent.id)?.content ?? null,
        expectedLanguage: agent.expected_language,
        action: req.action,
        input: req.input ?? null,
        output: req.output,
      }),
      timeoutMs,
    );
  } catch (err) {
    console.error(`[ai check] failed for ${agent.id}:`, (err as Error).message);
  }

  const hold = !j || j.verdict === "error" || (p.hold_on === "doubt" && j.verdict === "doubt");
  if (!hold) return null;

  run(db, "UPDATE rules SET trigger_count = trigger_count + 1 WHERE id = ?", rule.id);
  const found = j
    ? [j.summary, ...j.issues.map((i) => `• ${i.detail}`)].join("\n")
    : tr("The AI check could not run in time, so a human decides.", "La vérification IA n'a pas pu se faire à temps : un humain décide.");
  const output = req.output.trim();
  const context = [
    req.context?.trim(),
    `${tr("AI check", "Vérification IA")}:\n${found}`,
    `${tr("About to be sent", "Sur le point d'être envoyé")}:\n${output.length > SHOWN_OUTPUT ? output.slice(0, SHOWN_OUTPUT) + "…" : output}`,
  ].filter(Boolean).join("\n\n");
  const reason = j
    ? tr(`the AI check found a problem: ${j.summary}`, `la vérification IA a trouvé un problème : ${j.summary}`)
    : tr("the AI check could not run in time.", "la vérification IA n'a pas pu se faire à temps.");
  const id = requestApproval(db, agent, { ...req, context }, reason, now);
  return {
    decision: "needs_approval",
    reason: j ? tr(`AI check: ${j.summary}`, `Vérification IA : ${j.summary}`) : tr("AI check unavailable: human approval required.", "Vérification IA indisponible : validation humaine requise."),
    approval_id: id,
    rule_id: rule.id,
  };
}
