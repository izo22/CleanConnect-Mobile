import { useData, type QualityView } from "../api.ts";
import { ago, many, num, pct } from "../format.ts";
import { tr } from "../i18n.ts";
import { ErrorBox, Skeleton } from "../components/ui.tsx";
import { FlaggedCard } from "../components/quality.tsx";

export function Quality() {
  const { data, error } = useData<QualityView>("/api/quality");
  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("Quality", "Qualité")}</h1>
          <span className="sub">{tr("An AI re-reads part of your agents' answers and flags the ones that look wrong. You decide.", "Une IA relit une partie des réponses de vos agents et signale celles qui semblent fausses. Vous tranchez.")}</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={2} />}
      {data && (
        <>
          {data.reviewer.enabled ? (
            <div className="banner on">
              <span className="dot" />
              {tr("AI review on · ", "Relecture IA active · ")}
              {data.reviewer.pending > 0
                ? tr(`${data.reviewer.pending} answer${many(data.reviewer.pending) ? "s" : ""} waiting for review`, `${data.reviewer.pending} réponse${many(data.reviewer.pending) ? "s" : ""} en attente de relecture`)
                : tr("up to date", "à jour")}
            </div>
          ) : (
            <div className="banner off">
              <span className="dot" />
              {tr(
                "AI review paused: add an ANTHROPIC_API_KEY on the server to turn it on. The reviews shown here are demo examples.",
                "Relecture IA en pause : ajoutez une clé ANTHROPIC_API_KEY sur le serveur pour l'activer. Les relectures affichées ici sont des exemples de démonstration.",
              )}
            </div>
          )}

          <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="kpi violet">
              <span className="k">{tr("Answers reviewed", "Réponses relues")}</span><span className="v">{num(data.stats.reviewed)}</span><span className="h">{tr("last 7 days", "7 derniers jours")}</span>
            </div>
            <div className="kpi coral">
              <span className="k">{tr("Mistakes found", "Erreurs trouvées")}</span><span className="v">{num(data.stats.errors)}</span>
              <span className="h">{tr(`plus ${data.stats.doubts} to check`, `dont ${data.stats.doubts} à vérifier`)}</span>
            </div>
            <div className="kpi green">
              <span className="k">{tr("Correct answers", "Taux de réponses justes")}</span><span className="v">{pct(data.stats.quality)}</span><span className="h">{tr("of the reviewed answers", "sur les réponses relues")}</span>
            </div>
          </div>

          <section className="section" aria-labelledby="flag-h">
            <h2 id="flag-h" className="h2">{tr("To decide", "À trancher")} <span className="muted">· {data.flagged.length}</span></h2>
            {data.flagged.length === 0 ? (
              <p className="empty">{tr("Nothing to decide. The reviewed answers are correct.", "Rien à trancher. Les réponses relues sont correctes.")}</p>
            ) : (
              <div className="grid-cards">{data.flagged.map((x) => <FlaggedCard key={x.review_id} x={x} />)}</div>
            )}
          </section>

          {data.reports.length > 0 && (
            <section className="section" aria-labelledby="rep-h">
              <h2 id="rep-h" className="h2" style={{ fontSize: 22 }}>{tr("Mistakes reported by the team", "Erreurs signalées par l'équipe")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.reports.map((r) => (
                  <div key={r.id} className="resolved-row">
                    <span className="t"><strong>{r.agent_name}</strong> · {tr(`“${r.description}”`, `« ${r.description} »`)}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{r.author} · {ago(r.created_at)}</span>
                    <span className="pill" style={r.status === "open" ? { background: "#FFE9DF", color: "#9A3412" } : { background: "#DDF7E9", color: "#0E6B3F" }}>
                      {r.status === "open" ? tr("Open", "Ouvert") : tr("Fixed", "Réglé")}
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
