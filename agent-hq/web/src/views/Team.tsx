import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, useData, type AgentDetail, type AgentSummary } from "../api.ts";
import { ago, currencyAffix, money, num, pct, shortTime } from "../format.ts";
import { lang, tr } from "../i18n.ts";
import { Avatar, ErrorBox, Icon, Skeleton, Sparkline, StatusPill, Trust, useAction, useToast } from "../components/ui.tsx";
import { Exchange, ReportModal, VerdictPill } from "../components/quality.tsx";
import { ControlBlock, ControlChip } from "../components/control.tsx";
import { useCan, viewOnlyNote } from "../account.tsx";

type Filter = "all" | "issues" | "paused";
const filters = (): Array<{ id: Filter; label: string; test: (a: AgentSummary) => boolean }> => [
  { id: "all", label: tr("All", "Tous"), test: () => true },
  { id: "issues", label: tr("Needs a look", "À surveiller"), test: (a) => a.status === "attention" || a.status === "blocked" },
  { id: "paused", label: tr("Paused", "En pause"), test: (a) => a.status === "paused" },
];

const levels = () => [
  { label: tr("Level 0 · In training", "Niveau 0 · En formation"), desc: tr("It proposes, a human approves every action.", "Il propose, un humain valide chaque action.") },
  { label: tr("Level 1 · Trusted", "Niveau 1 · Confirmé"), desc: tr("It handles routine work alone and escalates sensitive actions.", "Il gère le courant seul et vous remonte les actions sensibles.") },
  { label: tr("Level 2 · Autonomous", "Niveau 2 · Autonome"), desc: tr("It acts alone; your guardrails always apply.", "Il agit seul ; vos garde-fous s'appliquent toujours.") },
];

/** When failures raise an alert: the three choices on the agent's page. */
const sensitivities = (): Array<{ id: "normal" | "high" | "strict"; label: string; desc: string }> => [
  { id: "normal", label: tr("Normal", "Normale"), desc: tr("Alert when half its tasks fail over 30 minutes. A failure now and then is ignored.", "Alerte quand la moitié de ses tâches échouent sur 30 minutes. Un échec de temps en temps est ignoré.") },
  { id: "high", label: tr("Alert at the first failure", "Alerte au premier échec"), desc: tr("For an important agent: you know as soon as one task fails.", "Pour un agent important : vous le savez dès qu'une tâche échoue.") },
  { id: "strict", label: tr("Alert, then pause after 3 failures", "Alerte, puis pause après 3 échecs"), desc: tr("For a critical agent: it stops itself after 3 failures in a row.", "Pour un agent critique : il s'arrête tout seul après 3 échecs d'affilée.") },
];

const PAGE = 24;

export function Team({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { data, error } = useData<AgentSummary[]>("/api/agents");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [creating, setCreating] = useState(false);
  const can = useCan();

  const shown = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const f = filters().find((x) => x.id === filter)!;
    return data.filter((a) => f.test(a) && (!q || `${a.name} ${a.mission} ${a.owner_name}`.toLowerCase().includes(q)));
  }, [data, filter, query]);

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("My AI team", "Mon équipe IA")}</h1>
          <span className="sub">{tr("Each agent has a mission, an owner, a budget and a trust level.", "Chaque agent a une mission, un responsable, un budget et un niveau de confiance.")}</span>
        </div>
        {can("member") && <button type="button" className="btn dark big" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> {tr("Add an agent", "Ajouter un agent")}</button>}
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div className="segmented" role="group" aria-label={tr("Filter agents", "Filtrer les agents")}>
          {filters().map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setLimit(PAGE); }}>
              {f.label}{data && f.id !== "all" ? ` · ${data.filter(f.test).length}` : ""}
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder={tr("Search for an agent, a mission, an owner…", "Chercher un agent, une mission, un responsable…")}
          aria-label={tr("Search for an agent", "Chercher un agent")} value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
      </div>

      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={6} />}
      {data && (
        <div className="team-layout">
          <div className="team-grid">
            {shown.slice(0, limit).map((a) => <AgentCard key={a.id} agent={a} selected={a.id === selected} onSelect={() => onSelect(a.id)} />)}
            {shown.length === 0 && <p className="sub">{tr("No agent matches.", "Aucun agent ne correspond.")}</p>}
            {shown.length > limit && (
              <div className="more">
                <button type="button" className="btn white big" onClick={() => setLimit((l) => l + PAGE)}>
                  {tr(`Show more (${shown.length - limit} others)`, `Afficher plus (${shown.length - limit} autres)`)}
                </button>
              </div>
            )}
          </div>
          {selected && <AgentDrawer id={selected} onClose={() => onSelect(null)} />}
        </div>
      )}
      {creating && <CreateAgent onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onSelect(id); }} />}
    </>
  );
}

function AgentCard({ agent: a, selected, onSelect }: { agent: AgentSummary; selected: boolean; onSelect: () => void }) {
  const { run, busy } = useAction();
  const can = useCan();
  return (
    <article className={"agent-card" + (selected ? " selected" : "")}>
      <button type="button" className="head" onClick={onSelect} aria-label={tr(`Open ${a.name}'s page`, `Ouvrir la fiche de ${a.name}`)}>
        <Avatar id={a.id} name={a.name} size={46} />
        <span style={{ minWidth: 0 }}>
          <span className="n">{a.name}</span>
          <span className="o">{a.source === "n8n" ? tr("n8n workflow", "Workflow n8n") : a.owner_name}</span>
        </span>
      </button>
      <p className="mission">{a.mission}</p>
      <ControlChip control={a.control} />
      <div className="line"><StatusPill status={a.status} /><Trust level={a.autonomy} /></div>
      <Sparkline values={a.sparkline} width={214} height={30} color={a.status === "ok" ? "#5B3DF5" : a.status === "paused" || a.status === "waiting" ? "#9C97A3" : "#FF7A45"} />
      <div className="minis">
        <div><span>{tr("Success", "Réussite")}</span><b>{pct(a.success_rate)}</b></div>
        <div><span>{tr("Tasks 24 h", "Tâches 24 h")}</span><b>{num(a.tasks_24h)}</b></div>
        <div title={a.source === "n8n" ? tr("n8n does not report the cost of AI calls", "n8n ne transmet pas le coût des appels d'IA") : undefined}>
          <span>{tr("Per task", "Par tâche")}</span>
          <b>{a.cost_per_task_cents == null || (a.source === "n8n" && !a.cost_per_task_cents) ? "—" : money(a.cost_per_task_cents, 2)}</b>
        </div>
      </div>
      {can("member") && (
        <button type="button" className="btn" disabled={busy !== null} onClick={() => run("p", `/api/agents/${a.id}/actions/${a.paused ? "resume" : "pause"}`)}>
          {a.paused ? tr("Resume", "Reprendre") : tr("Pause", "Mettre en pause")}
        </button>
      )}
    </article>
  );
}

function AgentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, reload } = useData<AgentDetail>(`/api/agents/${id}`);
  const { run, busy } = useAction();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [reporting, setReporting] = useState<{ eventId?: number; excerpt?: string | null } | null>(null);
  const operate = useCan()("member");

  useEffect(() => { setEditing(false); setShowKey(false); setReporting(null); }, [id]);

  if (error) return <aside className="drawer"><ErrorBox message={error.message} /></aside>;
  if (!data) return <aside className="drawer"><div className="skeleton" /></aside>;

  const active = data.prompts.find((p) => p.active);
  const canRollback = active ? data.prompts.some((p) => p.version < active.version) : false;
  const ratio = data.budget_cents ? data.spent_month_cents / data.budget_cents : 0;
  const patch = async (body: object, ok: string) => {
    try {
      await api(`/api/agents/${id}`, { method: "PATCH", body });
      toast(ok);
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <aside className="drawer" aria-label={tr(`${data.name}'s page`, `Fiche de ${data.name}`)}>
      <div className="top">
        <Avatar id={data.id} name={data.name} size={58} />
        <div className="meta">
          <h2>{data.name}</h2>
          <span style={{ fontSize: 14, color: "#45424C" }}>{data.mission}</span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={tr("Close the page", "Fermer la fiche")}><Icon name="close" size={16} /></button>
      </div>

      <div className="facts">
        <div className="fact"><span>{tr("Owner", "Responsable")}</span><b>{data.owner_name || "—"}</b></div>
        <div className="fact" style={{ background: "transparent", padding: "12px 0" }}><span>{tr("Status", "Statut")}</span><StatusPill status={data.status} /></div>
        <div className="fact"><span>{tr("Tasks (24 h)", "Tâches (24 h)")}</span><b>{num(data.tasks_24h)}</b></div>
        <div className="fact"><span>{tr("Success", "Réussite")}</span><b>{pct(data.success_rate)}</b></div>
        <div className="fact"><span>{tr("Time saved (24 h)", "Temps gagné (24 h)")}</span><b>{tr(`${num(data.minutes_saved_24h / 60)} hrs`, `${num(data.minutes_saved_24h / 60)} h`)}</b></div>
        <div className="fact"><span>{tr("Platform", "Plateforme")}</span><b>{data.platform}</b></div>
      </div>
      {data.pause_reason && <span className="note">{tr("Paused: ", "En pause : ")}{data.pause_reason}</span>}

      {!(data.setup.activity && data.setup.permission) && <SetupChecklist agent={data} />}

      {operate && <ControlBlock agent={data} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="block-title">{tr("Trust level", "Niveau de confiance")}</span>
        <div className="levels" role="group" aria-label={tr("Trust level", "Niveau de confiance")}>
          {levels().map((l, i) => (
            <button key={i} type="button" className="level" aria-pressed={data.autonomy === i} disabled={!operate}
              onClick={() => data.autonomy !== i && patch({ autonomy: i }, tr(`${data.name} moves to level ${i}.`, `${data.name} passe au niveau ${i}.`))}>
              <span className="radio" />
              <span><b>{l.label}</b><small>{l.desc}</small></span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="block-title">{tr("When it fails", "Quand il échoue")}</span>
        <div className="levels" role="group" aria-label={tr("When it fails", "Quand il échoue")}>
          {sensitivities().map((s) => (
            <button key={s.id} type="button" className="level" aria-pressed={data.alert_sensitivity === s.id} disabled={!operate}
              onClick={() => data.alert_sensitivity !== s.id && patch({ alert_sensitivity: s.id }, tr(`Failure alerts for ${data.name}: ${s.label.toLowerCase()}.`, `Alertes d'échec pour ${data.name} : ${s.label.toLowerCase()}.`))}>
              <span className="radio" />
              <span><b>{s.label}</b><small>{s.desc}</small></span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span className="block-title">{tr("This month's budget", "Budget du mois")}</span>
          <span style={{ color: "#45424C" }}>{money(data.spent_month_cents, 0)} / {money(data.budget_cents, 0)}</span>
        </div>
        <div className={"bar" + (ratio > 0.85 ? " warn" : "")}><div style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
        <span className="muted" style={{ fontSize: 12 }}>
          {tr("Model: ", "Modèle : ")}{data.model_tier === "economy" ? tr("budget", "économique") : tr("standard", "standard")}
        </span>
      </div>

      {data.access.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="block-title">{tr("What it is allowed to touch", "Ce qu'il a le droit de toucher")}</span>
          <div className="tags">{data.access.map((x) => <span key={x} className="tag">{x}</span>)}</div>
        </div>
      )}

      <div className="actions">
        {operate && (
          <button type="button" className="btn dark" disabled={busy !== null} onClick={() => run("p", `/api/agents/${id}/actions/${data.paused ? "resume" : "pause"}`).then(reload)}>
            {data.paused ? tr("Resume", "Reprendre") : tr("Pause", "Mettre en pause")}
          </button>
        )}
        {operate && canRollback && (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => run("r", `/api/agents/${id}/actions/rollback`).then(reload)}>
            {tr("Go back to the previous version", "Revenir à la version d'avant")}
          </button>
        )}
        {operate && !data.paused && (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => run("h", `/api/agents/${id}/actions/handoff`).then(reload)}>
            {tr(`Hand over to ${data.owner_name.split(" ")[0] || "a human"}`, `Confier à ${data.owner_name.split(" ")[0] || "un humain"}`)}
          </button>
        )}
        <button type="button" className="btn danger" onClick={() => setReporting({})}><Icon name="flag" size={15} /> {tr("Report a mistake", "Signaler une erreur")}</button>
      </div>
      {!operate && <span className="view-only">{viewOnlyNote()}</span>}

      <QualityBlock data={data} onReport={(eventId, excerpt) => setReporting({ eventId, excerpt })} onRate={operate ? (review_rate) =>
        patch(
          { review_rate },
          review_rate
            ? tr(`The AI will review ${Math.round(review_rate * 100)}% of its answers.`, `L'IA relira ${Math.round(review_rate * 100)} % de ses réponses.`)
            : tr("Review turned off for this agent.", "Relecture désactivée pour cet agent."),
        ) : undefined} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="block-title">{tr("Instructions", "Consignes")} {active ? `· version ${active.version}` : ""}</span>
          {operate && !editing && <button type="button" className="btn" onClick={() => { setPrompt(active?.content ?? ""); setEditing(true); }}>{tr("Edit", "Modifier")}</button>}
        </div>
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); patch({ prompt }, tr("New instructions saved.", "Nouvelles consignes enregistrées.")).then(() => setEditing(false)); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="field"><label htmlFor="prompt">{tr("What the agent must do", "Ce que l'agent doit faire")}</label><textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
            <div className="actions">
              <button type="submit" className="btn primary" disabled={!prompt.trim()}>{tr("Save as a new version", "Enregistrer une nouvelle version")}</button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>{tr("Cancel", "Annuler")}</button>
            </div>
          </form>
        ) : active ? (
          <details className="prompt"><summary>{tr("Read the current instructions", "Lire les consignes actuelles")}</summary><p>{active.content}</p></details>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>{tr("No instructions saved.", "Aucune consigne enregistrée.")}</span>
        )}
      </div>

      {operate && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="block-title">{tr("Connection", "Connexion")}</span>
          <span className="muted" style={{ fontSize: 13 }}>{tr("Give this to the person who built the agent (n8n, Make, SDK…).", "Donnez ces informations à la personne qui a construit l'agent (n8n, Make, SDK…).")}</span>
          {showKey ? (
            <>
              <div className="code">{`curl -X POST ${origin}/api/v1/events \\
    -H "Authorization: Bearer ${data.api_key}" \\
    -H "Content-Type: application/json" \\
    -d '{"kind":"task","action":"email.send","cost_cents":2}'`}</div>
              <div className="actions">
                <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(data.api_key).then(() => toast(tr("Key copied.", "Clé copiée.")))}>{tr("Copy the key", "Copier la clé")}</button>
                <button type="button" className="btn"
                  onClick={() => run("k", `/api/agents/${id}/rotate-key`).then(() => { toast(tr("New key created. The old one no longer works.", "Nouvelle clé créée. L'ancienne ne fonctionne plus.")); reload(); })}>
                  {tr("Change the key", "Changer la clé")}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setShowKey(true)}>{tr("Show the connection key", "Afficher la clé de connexion")}</button>
          )}
        </div>
      )}

      {data.activity.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="block-title">{tr("Log", "Journal")}</span>
          <div className="timeline">
            {data.activity.map((x) => (
              <div key={x.id} className="it"><time dateTime={new Date(x.ts).toISOString()}>{shortTime(x.ts)}</time><span><strong>{x.actor}</strong> · {x.message}</span></div>
            ))}
          </div>
        </div>
      )}
      {reporting && <ReportModal agentId={data.id} agentName={data.name} eventId={reporting.eventId} excerpt={reporting.excerpt} onClose={() => { setReporting(null); reload(); }} />}
    </aside>
  );
}

const RATES = [0, 0.05, 0.1, 0.25, 1];

/** What is wired so far: a pilot sees at a glance whether their connection works. */
function SetupChecklist({ agent }: { agent: AgentDetail }) {
  const n8n = agent.source === "n8n";
  const steps = [
    { done: true, title: tr("Added to Orvanta", "Ajouté à Orvanta"), hint: null },
    {
      done: agent.setup.activity,
      title: agent.setup.activity
        ? tr(`Activity received · last ${ago(agent.last_activity_at!)}`, `Activité reçue · dernière ${ago(agent.last_activity_at!)}`)
        : tr("No activity received yet", "Aucune activité reçue pour l'instant"),
      hint: agent.setup.activity ? null : n8n
        ? tr("It shows up after the workflow's next run (n8n is read every 30 seconds).", "Elle apparaît après la prochaine exécution du workflow (n8n est lu toutes les 30 secondes).")
        : tr("Add a “Report Activity” step at the end of the Zap, or send events with the connection key below.", "Ajoutez une étape « Report Activity » en fin de Zap, ou envoyez des événements avec la clé de connexion ci-dessous."),
    },
    {
      done: agent.setup.permission,
      title: agent.setup.permission
        ? tr("Asks permission before acting", "Demande la permission avant d'agir")
        : tr("Doesn't ask permission yet (optional)", "Ne demande pas encore la permission (facultatif)"),
      hint: agent.setup.permission ? null : n8n
        ? tr("Needed for approvals and the AI check: add the “Ask for permission” block below to the workflow.", "Nécessaire pour les validations et la vérification IA : ajoutez au workflow le bloc « Demander l'autorisation » ci-dessous.")
        : tr("Needed for approvals and the AI check: add an “Ask Permission” step before the sensitive action in the Zap.", "Nécessaire pour les validations et la vérification IA : ajoutez une étape « Ask Permission » avant l'action sensible dans le Zap."),
    },
  ];
  return (
    <div className="setup" aria-label={tr("Connection checklist", "Liste de vérification de la connexion")}>
      <span className="block-title">{tr("Is it connected?", "Est-ce que c'est branché ?")}</span>
      {steps.map((s) => (
        <div key={s.title} className={"step" + (s.done ? " done" : "")}>
          <span className="mark" aria-hidden="true">{s.done ? <Icon name="tick" size={14} stroke={3} /> : null}</span>
          <span className="text">
            <b>{s.title}</b>
            {s.hint && <small>{s.hint}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

function QualityBlock({ data, onReport, onRate }: { data: AgentDetail; onReport: (eventId: number, excerpt: string | null) => void; onRate?: (rate: number) => void }) {
  const q = data.quality;
  const reviewedIds = new Set(q.recent.map((r) => r.event_id));
  const unreviewed = q.latest.filter((e) => !reviewedIds.has(e.id)).slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span className="block-title">{tr("Answer quality", "Qualité des réponses")}</span>
        <span style={{ fontSize: 13, color: "#45424C" }}>
          {q.stats.reviewed
            ? tr(`${pct(q.stats.quality)} correct · ${q.stats.reviewed} reviewed in 7 days`, `${pct(q.stats.quality)} justes · ${q.stats.reviewed} relues en 7 j`)
            : tr("No review yet", "Pas encore de relecture")}
        </span>
      </div>
      <div className="field">
        <label htmlFor="rate">{tr("Share of answers reviewed by the AI", "Part des réponses relues par l'IA")}</label>
        <select id="rate" value={RATES.includes(data.review_rate) ? data.review_rate : 0.1} onChange={(e) => onRate?.(Number(e.target.value))} disabled={data.autonomy === 0 || !onRate}>
          {RATES.map((r) => <option key={r} value={r}>{r === 0 ? tr("None", "Aucune") : r === 1 ? tr("All", "Toutes") : pct(r)}</option>)}
        </select>
        {data.autonomy === 0 && <span className="hint">{tr("At level 0, all its answers are reviewed.", "Au niveau 0, toutes ses réponses sont relues.")}</span>}
      </div>
      {q.recent.map((x) => (
        <div key={x.review_id} className="mini-ex">
          <div className="top"><VerdictPill verdict={x.verdict} /><span className="muted" style={{ fontSize: 12 }}>{shortTime(x.ts)}{x.human_verdict === "confirmed" ? tr(" · confirmed", " · confirmée") : x.human_verdict === "dismissed" ? tr(" · false alarm", " · fausse alerte") : ""}</span></div>
          <p>{x.summary}</p>
          <details className="more-ex"><summary>{tr("See the exchange", "Voir l'échange")}</summary><Exchange input={x.input} output={x.output} /></details>
          {x.verdict === "ok" && !x.human_verdict && (
            <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => onReport(x.event_id, x.output)}>{tr("Actually, it's wrong", "En fait, c'est faux")}</button>
          )}
        </div>
      ))}
      {unreviewed.length > 0 && (
        <>
          <span className="muted" style={{ fontSize: 13 }}>{tr("Latest answers, not reviewed yet:", "Dernières réponses, pas encore relues :")}</span>
          {unreviewed.map((e) => (
            <div key={e.id} className="mini-ex">
              <details className="more-ex"><summary>{shortTime(e.ts)} · {(e.output ?? "").slice(0, 70)}{(e.output ?? "").length > 70 ? "…" : ""}</summary><Exchange input={e.input} output={e.output} /></details>
              <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => onReport(e.id, e.output)}>{tr("Report a mistake", "Signaler une erreur")}</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function CreateAgent({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", mission: "", owner_name: "", owner_email: "", platform: "n8n", budget: "50", autonomy: "0", prompt: "", language: lang() as string });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api<AgentDetail>("/api/agents", {
        method: "POST",
        body: {
          name: form.name.trim(), mission: form.mission.trim(), owner_name: form.owner_name.trim(), owner_email: form.owner_email.trim(),
          platform: form.platform, budget_cents: Math.round(Number(form.budget || 0) * 100), autonomy: Number(form.autonomy),
          expected_language: form.language || null, ...(form.prompt.trim() ? { prompt: form.prompt.trim() } : {}),
        },
      });
      toast(tr(`${created.name} joined the team. It starts at level ${created.autonomy}.`, `${created.name} a rejoint l'équipe. Il démarre au niveau ${created.autonomy}.`));
      onCreated(created.id);
    } catch (err) {
      toast((err as Error).message, true);
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="new-agent-h" onSubmit={submit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 id="new-agent-h" className="h2">{tr("Add an agent", "Ajouter un agent")}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={tr("Close", "Fermer")}><Icon name="close" size={16} /></button>
        </div>
        <div className="field">
          <label htmlFor="n">{tr("Name", "Nom")}</label>
          <input id="n" required value={form.name} onChange={set("name")} placeholder={tr("Quote follow-ups", "Relance devis")} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="m">{tr("Its mission, in one sentence", "Sa mission, en une phrase")}</label>
          <input id="m" value={form.mission} onChange={set("mission")} placeholder={tr("Follows up on quotes left unanswered after 7 days", "Relance les devis restés sans réponse après 7 jours")} />
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="o">{tr("Owner", "Responsable")}</label>
            <input id="o" value={form.owner_name} onChange={set("owner_name")} placeholder={tr("First Last", "Prénom Nom")} />
          </div>
          <div className="field"><label htmlFor="oe">{tr("Owner's email", "E-mail du responsable")}</label><input id="oe" type="email" value={form.owner_email} onChange={set("owner_email")} /></div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="b">{tr("Monthly budget", "Budget mensuel")} ({(currencyAffix().before || currencyAffix().after).trim()})</label>
            <input id="b" type="number" min="0" step="1" value={form.budget} onChange={set("budget")} />
          </div>
          <div className="field"><label htmlFor="p">{tr("Built with", "Construit avec")}</label>
            <select id="p" value={form.platform} onChange={set("platform")}>
              {["n8n", "Make", "Zapier", "Claude Agent SDK", "OpenAI Agents", tr("Other", "Autre")].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="two">
          <div className="field"><label htmlFor="a">{tr("Starting trust level", "Niveau de confiance au départ")}</label>
            <select id="a" value={form.autonomy} onChange={set("autonomy")}>
              {levels().map((l, i) => <option key={i} value={String(i)}>{l.label}</option>)}
            </select>
            <span className="hint">{tr("Tip: start at level 0, move up once it has proven itself.", "Conseil : commencez au niveau 0, montez quand il a fait ses preuves.")}</span>
          </div>
          <div className="field"><label htmlFor="l">{tr("Expected language", "Langue attendue")}</label>
            <select id="l" value={form.language} onChange={set("language")}>
              <option value="en">{tr("English", "Anglais")}</option>
              <option value="fr">{tr("French", "Français")}</option>
              <option value="es">{tr("Spanish", "Espagnol")}</option>
              <option value="">{tr("Doesn't matter", "Peu importe")}</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="pr">{tr("Instructions (optional)", "Consignes (facultatif)")}</label>
          <textarea id="pr" value={form.prompt} onChange={set("prompt")} placeholder={tr("What the agent must do, and never do.", "Ce que l'agent doit faire et ne jamais faire.")} />
        </div>
        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn big" onClick={onClose}>{tr("Cancel", "Annuler")}</button>
          <button type="submit" className="btn primary big" disabled={saving || !form.name.trim()}>{saving ? tr("Creating…", "Création…") : tr("Add to the team", "Ajouter à l'équipe")}</button>
        </div>
      </form>
    </div>
  );
}
