import { hourLabel, money, tr } from "./i18n.ts";
import type { RuleKind, RuleRow } from "./model.ts";

/** The guardrails every workspace starts with: they can be turned off, not deleted. */
const BUILT_IN = ["refunds", "quiet-hours", "monthly-budget", "repeat-pause", "ai-check"];
export const ruleDeletable = (rule: Pick<RuleRow, "id" | "workspace_id">) => !BUILT_IN.some((k) => rule.id === `${rule.workspace_id}:${k}`);

/** One sentence per guardrail, rebuilt from its parameters. */
export function describeRule(kind: RuleKind, subject: string, p: Record<string, unknown>): string {
  switch (kind) {
    case "approval_amount":
      if (p.action_prefix === "*") return tr(`Human approval for any action over ${money(Number(p.max_cents))}`, `Validation humaine pour toute action au-dessus de ${money(Number(p.max_cents))}`);
      return tr(`Human approval for any ${subject} over ${money(Number(p.max_cents))}`, `Validation humaine pour tout ${subject} au-dessus de ${money(Number(p.max_cents))}`);
    case "quiet_hours": {
      const [from, to] = [hourLabel(Number(p.start_hour)), hourLabel(Number(p.end_hour))];
      return tr(`No ${subject} between ${from} and ${to}`, `Aucun ${subject} entre ${from} et ${to}`);
    }
    case "global_budget":
      return tr(`Total AI spend capped at ${money(Number(p.max_cents))} per month`, `Dépense IA totale plafonnée à ${money(Number(p.max_cents))} par mois`);
    case "ai_check":
      return p.hold_on === "error"
        ? tr(`AI check of every ${subject} before it goes out: anything clearly wrong waits for a human`, `Vérification IA de chaque ${subject} avant l'envoi : tout ce qui est faux attend un humain`)
        : tr(`AI check of every ${subject} before it goes out: anything doubtful waits for a human`, `Vérification IA de chaque ${subject} avant l'envoi : tout ce qui est douteux attend un humain`);
    case "written":
      return String(p.text ?? "");
    case "daily_total":
      return tr(`At most ${money(Number(p.max_cents))} per day in total without my approval`, `Pas plus de ${money(Number(p.max_cents))} par jour au total sans ma validation`);
    case "repeat_pause":
      return tr(
        `Automatic pause if an agent repeats more than ${p.count} actions in ${p.window_min} minutes`,
        `Pause automatique si un agent fait plus de ${p.count} actions en double en ${p.window_min} minutes`,
      );
  }
}
