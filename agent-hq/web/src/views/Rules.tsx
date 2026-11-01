import { useEffect, useState } from "react";
import { api, useData, type AgentSummary, type RuleView } from "../api.ts";
import { ErrorBox, Skeleton, useToast } from "../components/ui.tsx";
import { currencyAffix, parseNumber } from "../format.ts";
import { lang, tr } from "../i18n.ts";
import { useCan, viewOnlyNote } from "../account.tsx";

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
      if (rule.params.action_prefix === "*") {
        return fr ? <>Validation humaine pour toute action au-dessus de {amount("Montant maximum")}</> : <>Human approval for any action over {amount("Maximum amount")}</>;
      }
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
    case "ai_check": {
      const hold = (
        <select aria-label={tr("What waits for a human", "Ce qui attend un humain")} value={String(rule.params.hold_on ?? "doubt")} onChange={(e) => save({ hold_on: e.target.value })}>
          <option value="doubt">{fr ? "tout ce qui est douteux" : "anything doubtful"}</option>
          <option value="error">{fr ? "seulement ce qui est faux" : "only what is clearly wrong"}</option>
        </select>
      );
      return fr
        ? <>Vérification IA de chaque {rule.label} avant l'envoi : {hold} attend un humain</>
        : <>AI check of every {rule.label} before it goes out: {hold} waits for a human</>;
    }
    case "daily_total":
      return fr
        ? <>Pas plus de {amount("Plafond par jour")} par jour au total sans ma validation</>
        : <>At most {amount("Daily cap")} per day in total without my approval</>;
    case "repeat_pause": {
      const count = <NumberInput label={tr("Number of repeated actions", "Nombre d'actions en double")} value={p.count} onSave={(v) => save({ count: Math.max(1, v) })} />;
      const minutes = <NumberInput label={tr("Duration in minutes", "Durée en minutes")} value={p.window_min} onSave={(v) => save({ window_min: Math.max(1, v) })} />;
      return fr
        ? <>Pause automatique si un agent fait plus de {count} actions en double en {minutes} minutes</>
        : <>Automatic pause if an agent repeats more than {count} actions in {minutes} minutes</>;
    }
  }
}

/** Which agents a rule covers: all of them, or the ones ticked. */
function Scope({ rule, agents, save }: { rule: RuleView; agents: AgentSummary[]; save: (agents: string[]) => void }) {
  const chosen = ((rule.params as { agents?: string[] }).agents ?? []).filter((id) => agents.some((a) => a.id === id));
  const label = chosen.length === 0
    ? tr("All agents", "Tous les agents")
    : agents.filter((a) => chosen.includes(a.id)).map((a) => a.name).join(", ");
  const toggle = (id: string) => save(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  return (
    <details className="scope">
      <summary>{tr("Applies to: ", "S'applique à : ")}<b>{label}</b></summary>
      <div className="scope-list">
        <label><input type="checkbox" checked={chosen.length === 0} onChange={() => chosen.length && save([])} /> {tr("All agents", "Tous les agents")}</label>
        {agents.map((a) => (
          <label key={a.id}><input type="checkbox" checked={chosen.includes(a.id)} onChange={() => toggle(a.id)} /> {a.name}</label>
        ))}
      </div>
    </details>
  );
}

/** The owner's own rules for the AI check, one per line. */
function AiInstructions({ rule, save }: { rule: RuleView; save: (text: string) => void }) {
  const current = String((rule.params as { instructions?: string }).instructions ?? "");
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  return (
    <div className="field" style={{ marginTop: 4 }}>
      <label htmlFor={`ai-rules-${rule.id}`}>{tr("Your rules for the AI (one per line)", "Vos consignes pour l'IA (une par ligne)")}</label>
      <textarea id={`ai-rules-${rule.id}`} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 90 }}
        placeholder={tr("Never promise a discount over 10%\nNever give an installation date\nAlways write formally", "Ne jamais promettre une remise de plus de 10 %\nNe jamais donner de date d'installation\nToujours vouvoyer le client")} />
      <span className="hint">{tr("A message that breaks one of them waits for you, with the reason.", "Un message qui enfreint l'une d'elles vous attend, avec la raison.")}</span>
      {text.trim() !== current.trim() && (
        <button type="button" className="btn primary small" style={{ alignSelf: "flex-start" }} onClick={() => save(text.trim())}>{tr("Save my rules", "Enregistrer mes consignes")}</button>
      )}
    </div>
  );
}

/** "+ Add a rule": the two guardrails an owner adds most, for any action. */
function AddRule({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const add = async (kind: "approval_amount" | "daily_total", max_cents: number) => {
    setBusy(true);
    try {
      await api("/api/rules", { method: "POST", body: { kind, max_cents } });
      toast(tr("Rule added: change the amount and the agents in it.", "Règle ajoutée : changez le montant et les agents dans la règle."));
      onAdded();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="h2" style={{ fontSize: 20 }}>{tr("+ Add a rule", "+ Ajouter une règle")}</h2>
      <div className="levels">
        <button type="button" className="level" disabled={busy} onClick={() => add("approval_amount", 100000)}>
          <span className="radio" />
          <span><b>{tr("Over an amount, I approve", "Au-dessus d'un montant, je valide")}</b><small>{tr("For any action with an amount: quote, payment, order, refund…", "Pour toute action avec un montant : devis, paiement, commande, remboursement…")}</small></span>
        </button>
        <button type="button" className="level" disabled={busy} onClick={() => add("daily_total", 100000)}>
          <span className="radio" />
          <span><b>{tr("At most this much per day", "Pas plus de tant par jour")}</b><small>{tr("Above this total for the day, everything waits for you. Stops a series of small mistakes.", "Au-delà de ce total sur la journée, tout vous attend. Arrête une série de petites erreurs.")}</small></span>
        </button>
      </div>
      <span className="muted" style={{ fontSize: 13 }}>{tr("Amounts come from the agents: the Amount field of Ask Permission (Zapier), or the amount field chosen when protecting an n8n step.", "Les montants viennent des agents : champ « Amount » d'Ask Permission (Zapier), ou champ du montant choisi en protégeant une étape n8n.")}</span>
    </section>
  );
}

export function Rules() {
  const { data, error, reload } = useData<RuleView[]>("/api/rules");
  const { data: agents } = useData<AgentSummary[]>("/api/agents");
  const toast = useToast();
  const operate = useCan()("member");
  const remove = async (rule: RuleView) => {
    if (!window.confirm(tr(`Delete this rule? “${rule.sentence}”`, `Supprimer cette règle ? « ${rule.sentence} »`))) return;
    try {
      await api(`/api/rules/${encodeURIComponent(rule.id)}`, { method: "DELETE" });
      toast(tr("Rule deleted.", "Règle supprimée."));
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const update = async (rule: RuleView, body: object, message: string) => {
    try {
      await api(`/api/rules/${encodeURIComponent(rule.id)}`, { method: "PATCH", body });
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
      {data && !operate && <span className="view-only">{viewOnlyNote()}</span>}
      {data && (
        // A disabled fieldset locks every number and switch for viewers.
        <fieldset disabled={!operate} className="plain" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((r) => {
            const hot = r.kind === "repeat_pause" && !r.enabled;
            const explain = r.kind === "ai_check"
              ? r.unavailable
                ? tr("Not running: the AI key isn't set on this server yet.", "Inactive : la clé IA n'est pas encore configurée sur ce serveur.")
                : tr("Works when the agent sends what it is about to send (Ask Permission → “Text About to Be Sent”).", "Fonctionne quand l'agent envoie ce qu'il s'apprête à envoyer (Ask Permission → « Text About to Be Sent »).")
              : null;
            return (
              <div key={r.id} className={"rule" + (hot ? " hot" : "")}>
                <div className="body">
                  <span className="sentence"><Sentence rule={r} save={(params) => update(r, { params }, tr("Rule updated.", "Règle mise à jour."))} /></span>
                  {explain && <span className="stat">{explain}</span>}
                  {r.kind === "ai_check" && <AiInstructions rule={r} save={(instructions) => update(r, { params: { instructions } }, tr("Your rules for the AI are saved.", "Vos consignes pour l'IA sont enregistrées."))} />}
                  {r.kind !== "global_budget" && agents && agents.length > 0 && (
                    <Scope rule={r} agents={agents} save={(list) => update(r, { params: { agents: list } }, tr("Agents of this rule updated.", "Agents de la règle mis à jour."))} />
                  )}
                  <span className="stat">
                    {hot
                      ? tr("Recommended: stops an agent stuck in a loop before it writes to your customers.", "Recommandé : arrête un agent qui part en boucle avant qu'il n'écrive à vos clients.")
                      : r.trigger_count
                        ? tr(`Triggered ${r.trigger_count} time${r.trigger_count === 1 ? "" : "s"}`, `Déclenchée ${r.trigger_count} fois`)
                        : tr("Never triggered so far", "Jamais déclenchée pour l'instant")}
                  </span>
                </div>
                {r.deletable && (
                  <button type="button" className="icon-btn" aria-label={tr(`Delete: ${r.sentence}`, `Supprimer : ${r.sentence}`)} title={tr("Delete", "Supprimer")} onClick={() => remove(r)}>✕</button>
                )}
                <input className="switch" type="checkbox" role="switch" aria-label={r.enabled ? tr(`Turn off: ${r.sentence}`, `Désactiver : ${r.sentence}`) : tr(`Turn on: ${r.sentence}`, `Activer : ${r.sentence}`)}
                  checked={r.enabled} onChange={() => update(r, { enabled: !r.enabled }, r.enabled ? tr("Rule turned off.", "Règle désactivée.") : tr("Rule turned on.", "Règle activée."))} />
              </div>
            );
          })}
        </fieldset>
      )}
      {data && operate && <AddRule onAdded={reload} />}
    </>
  );
}
