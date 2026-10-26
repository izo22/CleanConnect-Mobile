import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, useData, type AgentDetail, type AgentSummary } from "../api.ts";
import { euros, num, pct, shortTime } from "../format.ts";
import { Avatar, ErrorBox, Icon, Skeleton, Sparkline, StatusPill, Trust, useAction, useToast } from "../components/ui.tsx";
import { Exchange, ReportModal, VerdictPill } from "../components/quality.tsx";

type Filter = "all" | "issues" | "paused";
const FILTERS: Array<{ id: Filter; label: string; test: (a: AgentSummary) => boolean }> = [
  { id: "all", label: "Tous", test: () => true },
  { id: "issues", label: "À surveiller", test: (a) => a.status === "attention" || a.status === "blocked" },
  { id: "paused", label: "En pause", test: (a) => a.status === "paused" },
];

const LEVELS = [
  { label: "Niveau 0 · En formation", desc: "Il propose, un humain valide chaque action." },
  { label: "Niveau 1 · Confirmé", desc: "Il gère le courant seul et vous remonte les actions sensibles." },
  { label: "Niveau 2 · Autonome", desc: "Il agit seul ; vos garde-fous s'appliquent toujours." },
];

const PAGE = 24;

export function Team({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { data, error } = useData<AgentSummary[]>("/api/agents");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [creating, setCreating] = useState(false);

  const shown = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const f = FILTERS.find((x) => x.id === filter)!;
    return data.filter((a) => f.test(a) && (!q || `${a.name} ${a.mission} ${a.owner_name}`.toLowerCase().includes(q)));
  }, [data, filter, query]);

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">Mon équipe IA</h1>
          <span className="sub">Chaque agent a une mission, un responsable, un budget et un niveau de confiance.</span>
        </div>
        <button type="button" className="btn dark big" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Ajouter un agent</button>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div className="segmented" role="group" aria-label="Filtrer les agents">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setLimit(PAGE); }}>
              {f.label}{data && f.id !== "all" ? ` · ${data.filter(f.test).length}` : ""}
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Chercher un agent, une mission, un responsable…" aria-label="Chercher un agent" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
      </div>

      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={6} />}
      {data && (
        <div className="team-layout">
          <div className="team-grid">
            {shown.slice(0, limit).map((a) => <AgentCard key={a.id} agent={a} selected={a.id === selected} onSelect={() => onSelect(a.id)} />)}
            {shown.length === 0 && <p className="sub">Aucun agent ne correspond.</p>}
            {shown.length > limit && (
              <div className="more"><button type="button" className="btn white big" onClick={() => setLimit((l) => l + PAGE)}>Afficher plus ({shown.length - limit} autres)</button></div>
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
  return (
    <article className={"agent-card" + (selected ? " selected" : "")}>
      <button type="button" className="head" onClick={onSelect} aria-label={`Ouvrir la fiche de ${a.name}`}>
        <Avatar id={a.id} name={a.name} size={46} />
        <span style={{ minWidth: 0 }}>
          <span className="n">{a.name}</span>
          <span className="o">{a.owner_name}</span>
        </span>
      </button>
      <p className="mission">{a.mission}</p>
      <div className="line"><StatusPill status={a.status} /><Trust level={a.autonomy} /></div>
      <Sparkline values={a.sparkline} width={214} height={30} color={a.status === "ok" ? "#5B3DF5" : a.status === "paused" ? "#9C97A3" : "#FF7A45"} />
      <div className="minis">
        <div><span>Réussite</span><b>{pct(a.success_rate)}</b></div>
        <div><span>Tâches 24 h</span><b>{num(a.tasks_24h)}</b></div>
        <div><span>Par tâche</span><b>{a.cost_per_task_cents == null ? "—" : euros(a.cost_per_task_cents, 2)}</b></div>
      </div>
      <button type="button" className="btn" disabled={busy !== null} onClick={() => run("p", `/api/agents/${a.id}/actions/${a.paused ? "resume" : "pause"}`)}>
        {a.paused ? "Reprendre" : "Mettre en pause"}
      </button>
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
    <aside className="drawer" aria-label={`Fiche de ${data.name}`}>
      <div className="top">
        <Avatar id={data.id} name={data.name} size={58} />
        <div className="meta">
          <h2>{data.name}</h2>
          <span style={{ fontSize: 14, color: "#45424C" }}>{data.mission}</span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer la fiche"><Icon name="close" size={16} /></button>
      </div>

      <div className="facts">
        <div className="fact"><span>Responsable</span><b>{data.owner_name || "—"}</b></div>
        <div className="fact" style={{ background: "transparent", padding: "12px 0" }}><span>Statut</span><StatusPill status={data.status} /></div>
        <div className="fact"><span>Tâches (24 h)</span><b>{num(data.tasks_24h)}</b></div>
        <div className="fact"><span>Réussite</span><b>{pct(data.success_rate)}</b></div>
        <div className="fact"><span>Temps gagné (24 h)</span><b>{num(data.minutes_saved_24h / 60)} h</b></div>
        <div className="fact"><span>Plateforme</span><b>{data.platform}</b></div>
      </div>
      {data.pause_reason && <span className="note">En pause : {data.pause_reason}</span>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="block-title">Niveau de confiance</span>
        <div className="levels" role="group" aria-label="Niveau de confiance">
          {LEVELS.map((l, i) => (
            <button key={i} type="button" className="level" aria-pressed={data.autonomy === i} onClick={() => data.autonomy !== i && patch({ autonomy: i }, `${data.name} passe au ${l.label.split(" · ")[0].toLowerCase()}.`)}>
              <span className="radio" />
              <span><b>{l.label}</b><small>{l.desc}</small></span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span className="block-title">Budget du mois</span>
          <span style={{ color: "#45424C" }}>{euros(data.spent_month_cents, 0)} / {euros(data.budget_cents, 0)}</span>
        </div>
        <div className={"bar" + (ratio > 0.85 ? " warn" : "")}><div style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
        <span className="muted" style={{ fontSize: 12 }}>Modèle : {data.model_tier === "economy" ? "économique" : "standard"}</span>
      </div>

      {data.access.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="block-title">Ce qu'il a le droit de toucher</span>
          <div className="tags">{data.access.map((x) => <span key={x} className="tag">{x}</span>)}</div>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn dark" disabled={busy !== null} onClick={() => run("p", `/api/agents/${id}/actions/${data.paused ? "resume" : "pause"}`).then(reload)}>
          {data.paused ? "Reprendre" : "Mettre en pause"}
        </button>
        {canRollback && <button type="button" className="btn" disabled={busy !== null} onClick={() => run("r", `/api/agents/${id}/actions/rollback`).then(reload)}>Revenir à la version d'avant</button>}
        {!data.paused && <button type="button" className="btn" disabled={busy !== null} onClick={() => run("h", `/api/agents/${id}/actions/handoff`).then(reload)}>Confier à {data.owner_name.split(" ")[0] || "un humain"}</button>}
        <button type="button" className="btn danger" onClick={() => setReporting({})}><Icon name="flag" size={15} /> Signaler une erreur</button>
      </div>

      <QualityBlock data={data} onReport={(eventId, excerpt) => setReporting({ eventId, excerpt })} onRate={(review_rate) => patch({ review_rate }, review_rate ? `L'IA relira ${Math.round(review_rate * 100)} % de ses réponses.` : "Relecture désactivée pour cet agent.")} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="block-title">Consignes {active ? `· version ${active.version}` : ""}</span>
          {!editing && <button type="button" className="btn" onClick={() => { setPrompt(active?.content ?? ""); setEditing(true); }}>Modifier</button>}
        </div>
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); patch({ prompt }, "Nouvelles consignes enregistrées.").then(() => setEditing(false)); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="field"><label htmlFor="prompt">Ce que l'agent doit faire</label><textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
            <div className="actions"><button type="submit" className="btn primary" disabled={!prompt.trim()}>Enregistrer une nouvelle version</button><button type="button" className="btn" onClick={() => setEditing(false)}>Annuler</button></div>
          </form>
        ) : active ? (
          <details className="prompt"><summary>Lire les consignes actuelles</summary><p>{active.content}</p></details>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>Aucune consigne enregistrée.</span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="block-title">Connexion</span>
        <span className="muted" style={{ fontSize: 13 }}>Donnez ces informations à la personne qui a construit l'agent (n8n, Make, SDK…).</span>
        {showKey ? (
          <>
            <div className="code">{`curl -X POST ${origin}/api/v1/events \\
  -H "Authorization: Bearer ${data.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"kind":"task","action":"email.send","cost_cents":2}'`}</div>
            <div className="actions">
              <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(data.api_key).then(() => toast("Clé copiée."))}>Copier la clé</button>
              <button type="button" className="btn" onClick={() => run("k", `/api/agents/${id}/rotate-key`).then(() => { toast("Nouvelle clé créée. L'ancienne ne fonctionne plus."); reload(); })}>Changer la clé</button>
            </div>
          </>
        ) : (
          <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setShowKey(true)}>Afficher la clé de connexion</button>
        )}
      </div>

      {data.activity.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="block-title">Journal</span>
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

function QualityBlock({ data, onReport, onRate }: { data: AgentDetail; onReport: (eventId: number, excerpt: string | null) => void; onRate: (rate: number) => void }) {
  const q = data.quality;
  const reviewedIds = new Set(q.recent.map((r) => r.event_id));
  const unreviewed = q.latest.filter((e) => !reviewedIds.has(e.id)).slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span className="block-title">Qualité des réponses</span>
        <span style={{ fontSize: 13, color: "#45424C" }}>
          {q.stats.reviewed ? `${pct(q.stats.quality)} justes · ${q.stats.reviewed} relues en 7 j` : "Pas encore de relecture"}
        </span>
      </div>
      <div className="field">
        <label htmlFor="rate">Part des réponses relues par l'IA</label>
        <select id="rate" value={RATES.includes(data.review_rate) ? data.review_rate : 0.1} onChange={(e) => onRate(Number(e.target.value))} disabled={data.autonomy === 0}>
          {RATES.map((r) => <option key={r} value={r}>{r === 0 ? "Aucune" : r === 1 ? "Toutes" : `${Math.round(r * 100)} %`}</option>)}
        </select>
        {data.autonomy === 0 && <span className="hint">Au niveau 0, toutes ses réponses sont relues.</span>}
      </div>
      {q.recent.map((x) => (
        <div key={x.review_id} className="mini-ex">
          <div className="top"><VerdictPill verdict={x.verdict} /><span className="muted" style={{ fontSize: 12 }}>{shortTime(x.ts)}{x.human_verdict === "confirmed" ? " · confirmée" : x.human_verdict === "dismissed" ? " · fausse alerte" : ""}</span></div>
          <p>{x.summary}</p>
          <details className="more-ex"><summary>Voir l'échange</summary><Exchange input={x.input} output={x.output} /></details>
          {x.verdict === "ok" && !x.human_verdict && <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => onReport(x.event_id, x.output)}>En fait, c'est faux</button>}
        </div>
      ))}
      {unreviewed.length > 0 && (
        <>
          <span className="muted" style={{ fontSize: 13 }}>Dernières réponses, pas encore relues :</span>
          {unreviewed.map((e) => (
            <div key={e.id} className="mini-ex">
              <details className="more-ex"><summary>{shortTime(e.ts)} · {(e.output ?? "").slice(0, 70)}{(e.output ?? "").length > 70 ? "…" : ""}</summary><Exchange input={e.input} output={e.output} /></details>
              <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => onReport(e.id, e.output)}>Signaler une erreur</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function CreateAgent({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", mission: "", owner_name: "", owner_email: "", platform: "n8n", budget: "50", autonomy: "0", prompt: "", language: "fr" });
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
      toast(`${created.name} a rejoint l'équipe. Il démarre au niveau ${created.autonomy}.`);
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
          <h2 id="new-agent-h" className="h2">Ajouter un agent</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" size={16} /></button>
        </div>
        <div className="field"><label htmlFor="n">Nom</label><input id="n" required value={form.name} onChange={set("name")} placeholder="Relance devis" autoFocus /></div>
        <div className="field"><label htmlFor="m">Sa mission, en une phrase</label><input id="m" value={form.mission} onChange={set("mission")} placeholder="Relance les devis restés sans réponse après 7 jours" /></div>
        <div className="two">
          <div className="field"><label htmlFor="o">Responsable</label><input id="o" value={form.owner_name} onChange={set("owner_name")} placeholder="Prénom Nom" /></div>
          <div className="field"><label htmlFor="oe">E-mail du responsable</label><input id="oe" type="email" value={form.owner_email} onChange={set("owner_email")} /></div>
        </div>
        <div className="two">
          <div className="field"><label htmlFor="b">Budget mensuel (€)</label><input id="b" type="number" min="0" step="1" value={form.budget} onChange={set("budget")} /></div>
          <div className="field"><label htmlFor="p">Construit avec</label>
            <select id="p" value={form.platform} onChange={set("platform")}>
              {["n8n", "Make", "Zapier", "Claude Agent SDK", "OpenAI Agents", "Autre"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="two">
          <div className="field"><label htmlFor="a">Niveau de confiance au départ</label>
            <select id="a" value={form.autonomy} onChange={set("autonomy")}>
              <option value="0">Niveau 0 · En formation</option><option value="1">Niveau 1 · Confirmé</option><option value="2">Niveau 2 · Autonome</option>
            </select>
            <span className="hint">Conseil : commencez au niveau 0, montez quand il a fait ses preuves.</span>
          </div>
          <div className="field"><label htmlFor="l">Langue attendue</label>
            <select id="l" value={form.language} onChange={set("language")}>
              <option value="fr">Français</option><option value="en">Anglais</option><option value="">Peu importe</option>
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="pr">Consignes (facultatif)</label><textarea id="pr" value={form.prompt} onChange={set("prompt")} placeholder="Ce que l'agent doit faire et ne jamais faire." /></div>
        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn big" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary big" disabled={saving || !form.name.trim()}>{saving ? "Création…" : "Ajouter à l'équipe"}</button>
        </div>
      </form>
    </div>
  );
}
