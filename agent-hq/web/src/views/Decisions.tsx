import { useData, type ApprovalsView } from "../api.ts";
import { ago } from "../format.ts";
import { Avatar, DecisionButtons, ErrorBox, Skeleton } from "../components/ui.tsx";

export function Decisions() {
  const { data, error } = useData<ApprovalsView>("/api/approvals");
  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">Décisions</h1>
          <span className="sub">Vos agents s'arrêtent ici quand une action dépasse ce que vous leur avez autorisé.</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton />}
      {data && (
        <>
          {data.pending.length === 0 ? (
            <p className="empty">Rien à valider. Votre équipe avance seule.</p>
          ) : (
            <div className="grid-cards">
              {data.pending.map((p) => (
                <article key={p.id} className="card decision-card">
                  <div className="who">
                    <Avatar id={p.agent_id} name={p.agent?.name ?? "?"} />
                    <div className="meta">
                      <span className="name">{p.agent?.name} demande</span>
                      <span className="time">{ago(p.created_at)}</span>
                    </div>
                  </div>
                  <h3>{p.title}</h3>
                  {p.context && <p className="ctx">{p.context}</p>}
                  <p className="why"><strong>Pourquoi je vous demande :</strong> {p.reason}</p>
                  <div className="row"><DecisionButtons approval={p} big /></div>
                </article>
              ))}
            </div>
          )}
          {data.decided.length > 0 && (
            <section className="section" aria-labelledby="hist-h">
              <h2 id="hist-h" className="h2" style={{ fontSize: 22 }}>Historique</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.decided.map((d) => (
                  <div key={d.id} className="resolved-row">
                    <span className="t"><strong>{d.agent?.name}</strong> · {d.title}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{d.decided_by} · {d.decided_at ? ago(d.decided_at) : ""}</span>
                    <span className="pill" style={d.status === "approved" ? { background: "#DDF7E9", color: "#0E6B3F" } : { background: "#F1EDE7", color: "#45424C" }}>
                      {d.status === "approved" ? "Approuvé" : "Refusé"}
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
