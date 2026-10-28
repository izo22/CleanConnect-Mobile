import { hourLabel, money, tr } from "./i18n.ts";
import type { RuleKind } from "./model.ts";

/** One sentence per guardrail, rebuilt from its parameters. */
export function describeRule(kind: RuleKind, subject: string, p: Record<string, number | string>): string {
  switch (kind) {
    case "approval_amount":
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
    case "repeat_pause":
      return tr(
        `Automatic pause if an agent repeats more than ${p.count} actions in ${p.window_min} minutes`,
        `Pause automatique si un agent fait plus de ${p.count} actions en double en ${p.window_min} minutes`,
      );
  }
}
