import type { RuleKind } from "./model.ts";

/** One French sentence per guardrail, rebuilt from its parameters. */
export function describeRule(kind: RuleKind, subject: string, p: Record<string, number | string>): string {
  const eur = (c: unknown) => (Number(c) / 100).toLocaleString("fr-FR") + " €";
  switch (kind) {
    case "approval_amount":
      return `Validation humaine pour tout ${subject} au-dessus de ${eur(p.max_cents)}`;
    case "quiet_hours":
      return `Aucun ${subject} entre ${p.start_hour} h et ${p.end_hour} h`;
    case "global_budget":
      return `Dépense IA totale plafonnée à ${eur(p.max_cents)} par mois`;
    case "repeat_pause":
      return `Pause automatique si un agent fait plus de ${p.count} actions en double en ${p.window_min} minutes`;
  }
}
