import { useEffect, useState } from "react";
import { api, useData, type RuleView } from "../api.ts";
import { ErrorBox, Skeleton, useToast } from "../components/ui.tsx";

/** Editable number shown inline in the rule's sentence; saves on blur. */
function NumberInput({ value, onSave, label, scale = 1 }: { value: number; onSave: (v: number) => void; label: string; scale?: number }) {
  const [text, setText] = useState(String(value / scale));
  useEffect(() => setText(String(value / scale)), [value, scale]);
  const commit = () => {
    const v = Number(text.replace(",", "."));
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
  switch (rule.kind) {
    case "approval_amount":
      return <>Validation humaine pour tout {rule.label} au-dessus de <NumberInput label="Montant maximum en euros" value={p.max_cents} scale={100} onSave={(v) => save({ max_cents: v })} /> €</>;
    case "quiet_hours":
      return <>Aucun {rule.label} entre <NumberInput label="Heure de début" value={p.start_hour} onSave={(v) => save({ start_hour: v % 24 })} /> h et <NumberInput label="Heure de fin" value={p.end_hour} onSave={(v) => save({ end_hour: v % 24 })} /> h</>;
    case "global_budget":
      return <>Dépense IA totale plafonnée à <NumberInput label="Plafond mensuel en euros" value={p.max_cents} scale={100} onSave={(v) => save({ max_cents: v })} /> € par mois</>;
    case "repeat_pause":
      return <>Pause automatique si un agent fait plus de <NumberInput label="Nombre d'actions en double" value={p.count} onSave={(v) => save({ count: Math.max(1, v) })} /> actions en double en <NumberInput label="Durée en minutes" value={p.window_min} onSave={(v) => save({ window_min: Math.max(1, v) })} /> minutes</>;
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
          <h1 className="h1">Garde-fous</h1>
          <span className="sub">Des règles en français qui s'appliquent à toute votre équipe IA. Cliquez sur un chiffre pour le changer.</span>
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
                  <span className="sentence"><Sentence rule={r} save={(params) => update(r, { params }, "Règle mise à jour.")} /></span>
                  <span className="stat">
                    {hot
                      ? "Recommandé : arrête un agent qui part en boucle avant qu'il n'écrive à vos clients."
                      : r.trigger_count
                        ? `Déclenchée ${r.trigger_count} fois`
                        : "Jamais déclenchée pour l'instant"}
                  </span>
                </div>
                <input className="switch" type="checkbox" role="switch" aria-label={`${r.enabled ? "Désactiver" : "Activer"} : ${r.sentence}`} checked={r.enabled}
                  onChange={() => update(r, { enabled: !r.enabled }, r.enabled ? "Règle désactivée." : "Règle activée.")} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
