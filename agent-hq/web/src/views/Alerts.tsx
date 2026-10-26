import { useData, type AlertsView } from "../api.ts";
import { ago } from "../format.ts";
import { AlertCard, ErrorBox, Skeleton } from "../components/ui.tsx";

export function Alerts() {
  const { data, error } = useData<AlertsView>("/api/alerts");
  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">Alertes</h1>
          <span className="sub">Ce qui se passe, pourquoi, et quoi faire. Sans jargon.</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={2} />}
      {data && (
        <>
          {data.open.length === 0 ? (
            <p className="empty">Aucune alerte ouverte. Tout roule.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.open.map((a) => <AlertCard key={a.id} alert={a} wide />)}
            </div>
          )}
          {data.resolved.length > 0 && (
            <section className="section" aria-labelledby="res-h">
              <h2 id="res-h" className="h2" style={{ fontSize: 22 }}>Réglées récemment</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.resolved.map((a) => (
                  <div key={a.id} className="resolved-row">
                    <span className="check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E6B3F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                    <span className="t"><strong>{a.agent?.name}</strong> · {a.title}</span>
                    <span className="r">{a.resolution}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{a.resolved_at ? ago(a.resolved_at) : ""}</span>
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
