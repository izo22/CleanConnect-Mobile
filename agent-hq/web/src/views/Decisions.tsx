import { useData, type ApprovalsView } from "../api.ts";
import { ago } from "../format.ts";
import { tr } from "../i18n.ts";
import { useState } from "react";
import { Avatar, DecisionButtons, EditAndApprove, ErrorBox, Skeleton } from "../components/ui.tsx";

export function Decisions() {
  const { data, error } = useData<ApprovalsView>("/api/approvals");
  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("Decisions", "Décisions")}</h1>
          <span className="sub">{tr("Your agents stop here when an action goes beyond what you allowed them.", "Vos agents s'arrêtent ici quand une action dépasse ce que vous leur avez autorisé.")}</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton />}
      {data && (
        <>
          {data.pending.length === 0 ? (
            <p className="empty">{tr("Nothing to approve. Your team is moving on its own.", "Rien à valider. Votre équipe avance seule.")}</p>
          ) : (
            <div className="grid-cards">
              {data.pending.map((p) => <DecisionCard key={p.id} p={p} />)}
            </div>
          )}
          {data.decided.length > 0 && (
            <section className="section" aria-labelledby="hist-h">
              <h2 id="hist-h" className="h2" style={{ fontSize: 22 }}>{tr("History", "Historique")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.decided.map((d) => (
                  <div key={d.id} className="resolved-row">
                    <span className="t"><strong>{d.agent?.name}</strong> · {d.title}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{d.decided_by} · {d.decided_at ? ago(d.decided_at) : ""}{callbackText(d.callback_status)}</span>
                    <span className="pill" style={d.status === "approved" ? { background: "#DDF7E9", color: "#0E6B3F" } : { background: "#F1EDE7", color: "#45424C" }}>
                      {d.status === "approved" ? (d.edited_output != null ? tr("Approved with changes", "Approuvé avec modifications") : tr("Approved", "Approuvé")) : tr("Declined", "Refusé")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function DecisionCard({ p }: { p: ApprovalsView["pending"][number] }) {
  const [editing, setEditing] = useState(false);
  return (
    <article className="card decision-card">
      <div className="who">
        <Avatar id={p.agent_id} name={p.agent?.name ?? "?"} />
        <div className="meta">
          <span className="name">{tr(`${p.agent?.name} asks`, `${p.agent?.name} demande`)}</span>
          <span className="time">{ago(p.created_at)}</span>
        </div>
      </div>
      <h3>{p.title}</h3>
      {p.context && <p className="ctx">{p.context}</p>}
      {p.output && !editing && (
        <div className="draft">
          <span className="draft-label">{tr("What the agent will send", "Ce que l'agent va envoyer")}</span>
          <p>{p.output}</p>
        </div>
      )}
      <p className="why"><strong>{tr("Why I'm asking:", "Pourquoi je vous demande :")}</strong> {p.reason}</p>
      {p.callback_url && <p className="note">{tr("The workflow is on hold: it will resume as soon as you answer.", "Le workflow est en attente : il reprendra dès votre réponse.")}</p>}
      {editing
        ? <EditAndApprove approval={p} onCancel={() => setEditing(false)} />
        : <div className="row"><DecisionButtons approval={p} big onEdit={p.output ? () => setEditing(true) : undefined} /></div>}
    </article>
  );
}

function callbackText(status: string | null) {
  if (!status) return "";
  if (status === "sent") return tr(" · sent to the workflow", " · transmis au workflow");
  if (status.startsWith("refused")) return tr(" · the workflow was no longer waiting", " · le workflow n'attendait plus");
  return tr(" · could not reach the workflow", " · transmission au workflow impossible");
}
