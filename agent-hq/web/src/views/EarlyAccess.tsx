import { useData, type EarlyAccessView } from "../api.ts";
import { ago } from "../format.ts";
import { tr } from "../i18n.ts";
import { Avatar, ErrorBox, Skeleton } from "../components/ui.tsx";

/** Requests sent from the "Request early access" form of the public site. */
export function EarlyAccess() {
  const { data, error } = useData<EarlyAccessView[]>("/api/early-access");
  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("Early access", "Demandes d'accès")}</h1>
          <span className="sub">{tr("Requests sent from the form on your website. Reply by email to set up a pilot.", "Demandes envoyées depuis le formulaire de votre site. Répondez par e-mail pour lancer un pilote.")}</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={2} />}
      {data && data.length === 0 && (
        <p className="empty">{tr("No request yet. They will show up here as soon as someone fills in the form.", "Aucune demande pour l'instant. Elles apparaîtront ici dès que quelqu'un remplira le formulaire.")}</p>
      )}
      {data && data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((r) => (
            <article key={r.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="who">
                <Avatar id={r.email} name={r.name} />
                <div className="meta">
                  <span className="name">{r.name}{r.company ? ` · ${r.company}` : ""}</span>
                  <span className="time">{ago(r.created_at)}</span>
                </div>
                <a className="btn" style={{ textDecoration: "none" }} href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent("Orvanta early access")}`}>{r.email}</a>
              </div>
              {(r.tools.length > 0 || r.fleet) && (
                <div className="tags">
                  {r.tools.map((t) => <span key={t} className="tag">{t}</span>)}
                  {r.fleet && <span className="tag">{tr(`${r.fleet} agents`, `${r.fleet} agents`)}</span>}
                </div>
              )}
              {r.message && <p style={{ fontSize: 14, color: "#45424C", whiteSpace: "pre-wrap" }}>{r.message}</p>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
