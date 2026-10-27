import { useEffect, useState } from "react";
import { api, useData, type RuleView } from "../api.ts";
import { ErrorBox, Skeleton, useToast } from "../components/ui.tsx";
import { currencyAffix, parseNumber } from "../format.ts";
import { lang, tr } from "../i18n.ts";

/** Editable number shown inline in the rule's sentence; saves on blur. */
function NumberInput({ value, onSave, label, scale = 1 }: { value: number; onSave: (v: number) => void; label: string; scale?: number }) {
  const [text, setText] = useState(String(value / scale));
  useEffect(() => setText(String(value / scale)), [value, scale]);
  const commit = () => {
    const v = parseNumber(text);
    if (!Number.isFinite(v) || v < 0) { setText(String(value / scale)); return; }
    if (Math.round(v * scale) !== value) onSave(Math.round(v * scale));
  };
  return (
    <input aria-label={label} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );
}

function Sentence({ rule, save }: { rule: RuleView; save: (params: object) => void }) {
  const p = rule.params as Record<string, number>;
  const { before, after } = currencyAffix();
  const amount = (label: string) => (
    <>{before}<NumberInput label={label} value={p.max_cents} scale={100} onSave={(v) => save({ max_cents: v })} />{after}</>
  );
  const hour = (key: "start_hour" | "end_hour", label: string) => (
    <><NumberInput label={label} value={p[key]} onSave={(v) => save({ [key]: v % 24 })} />{lang() === "fr" ? " h" : ":00"}</>
  );
  const fr = lang() === "fr";
  switch (rule.kind) {
    case "approval_amount":
      return fr
        ? <>Validation humaine pour tout {rule.label} au-dessus de {amount("Montant maximum")}</>
        : <>Human approval for any {rule.label} over {amount("Maximum amount")}</>;
    case "quiet_hours":
      return fr
        ? <>Aucun {rule.label} entre {hour("start_hour", "Heure de début")} et {hour("end_hour", "Heure de fin")}</>
        : <>No {rule.label} between {hour("start_hour", "Start hour")} and {hour("end_hour", "End hour")}</>;
    case "global_budget":
      return fr
        ? <>Dépense IA totale plafonnée à {amount("Plafond mensuel")} par mois</>
        : <>Total AI spend capped at {amount("Monthly cap")} per month</>;
    case "repeat_pause": {
      const count = <NumberInput label={tr("Number of repeated actions", "Nombre d'actions en double")} value={p.count} onSave={(v) => save({ count: Math.max(1, v) })} />;
      const minutes = <NumberInput label={tr("Duration in minutes", "Durée en minutes")} value={p.window_min} onSave={(v) => save({ window_min: Math.max(1, v) })} />;
      return fr
        ? <>Pause automatique si un agent fait plus de {count} actions en double en {minutes} minutes</>
        : <>Automatic pause if an agent repeats more than {count} actions in {minutes} minutes</>;
    }
  }
}

export function Rules() {
  const { data, error, reload } = useData<RuleView[]>("/api/rules");
  const toast = useToast();
  const update = async (rule: RuleView, body: object, message: string) => {
    try {
      await api(`/api/rules/${rule.id}`, { method: "PATCH", body });
      toast(message);
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("Guardrails", "Garde-fous")}</h1>
          <span className="sub">{tr("Plain-English rules that apply to your whole AI team. Click a number to change it.", "Des règles en français qui s'appliquent à toute votre équipe IA. Cliquez sur un chiffre pour le changer.")}</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={2} />}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((r) => {
            const hot = r.kind === "repeat_pause" && !r.enabled;
            return (
              <div key={r.id} className={"rule" + (hot ? " hot" : "")}>
                <div className="body">
                  <span className="sentence"><Sentence rule={r} save={(params) => update(r, { params }, tr("Rule updated.", "Règle mise à jour."))} /></span>
                  <span className="stat">
                    {hot
                      ? tr("Recommended: stops an agent stuck in a loop before it writes to your customers.", "Recommandé : arrête un agent qui part en boucle avant qu'il n'écrive à vos clients.")
                      : r.trigger_count
                        ? tr(`Triggered ${r.trigger_count} time${r.trigger_count === 1 ? "" : "s"}`, `Déclenchée ${r.trigger_count} fois`)
                        : tr("Never triggered so far", "Jamais déclenchée pour l'instant")}
                  </span>
                </div>
                <input className="switch" type="checkbox" role="switch" aria-label={r.enabled ? tr(`Turn off: ${r.sentence}`, `Désactiver : ${r.sentence}`) : tr(`Turn on: ${r.sentence}`, `Activer : ${r.sentence}`)}
                  checked={r.enabled} onChange={() => update(r, { enabled: !r.enabled }, r.enabled ? tr("Rule turned off.", "Règle désactivée.") : tr("Rule turned on.", "Règle activée."))} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
