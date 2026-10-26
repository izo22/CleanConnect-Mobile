import { useData, type Overview } from "../api.ts";
import { euros, num, plural } from "../format.ts";
import { AlertCard, Avatar, DecisionButtons, ErrorBox, Icon, Ring, Skeleton } from "../components/ui.tsx";
import type { View } from "../App.tsx";

export function Brief({ go }: { go: (v: View) => void }) {
  const { data, error } = useData<Overview>("/api/overview");
  if (error) return <ErrorBox message={error.message} />;
  if (!data) return <Skeleton />;

  const { counts, alerts, approvals } = data;
  const todo = alerts.length + approvals.length;
  const hours = data.minutes_saved_24h / 60;
  const delta = data.cost_avg_day_cents ? (data.cost_24h_cents - data.cost_avg_day_cents) / data.cost_avg_day_cents : 0;
  const date = new Date(data.now).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="brief-top">
        <section className="hero" aria-label="Résumé">
          <div className="text">
            <span className="date">{date}</span>
            <h1>
              Bonjour !<br />
              {todo === 0 ? "Rien ne vous attend." : `${todo} ${todo > 1 ? "choses vous attendent." : "chose vous attend."}`}
            </h1>
            <span className="fleet">
              {counts.attention} à surveiller · {plural(counts.blocked, "bloqué", "bloqués")} · {counts.paused} en pause
            </span>
          </div>
          <Ring value={counts.ok} total={counts.total} label="en forme" />
        </section>
        <div className="kpis">
          <div className="kpi violet">
            <span className="k">Tâches réalisées</span>
            <span className="v">{num(data.tasks_24h)}</span>
            <span className="h">dernières 24 h</span>
          </div>
          <div className="kpi green">
            <span className="k">Temps gagné</span>
            <span className="v">{num(hours)} h</span>
            <span className="h">≈ {num(hours / 7)} personnes à temps plein</span>
          </div>
          <div className="kpi coral">
            <span className="k">Coût des 24 h</span>
            <span className="v">{euros(data.cost_24h_cents, 0)}</span>
            <span className="h">{delta >= 0 ? "+" : ""}{Math.round(delta * 100)} % vs moyenne</span>
          </div>
          <div className="kpi white">
            <span className="k">Au travail</span>
            <span className="v">{counts.total - counts.paused - counts.blocked}<small> /{counts.total}</small></span>
            <span className="h">agents actifs</span>
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="todo-h">
        <div className="section-head">
          <h2 id="todo-h" className="h2">À traiter aujourd'hui</h2>
          {alerts.length > 3 && <button type="button" className="link-btn" onClick={() => go("alerts")}>Voir les {alerts.length} alertes →</button>}
        </div>
        {alerts.length === 0 ? (
          <div className="all-clear">
            <span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B3B24" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
            <div><strong>Tout roule.</strong><span>Aucun incident ouvert. On vous prévient si ça change.</span></div>
          </div>
        ) : (
          <div className="grid-cards">{alerts.slice(0, 3).map((a) => <AlertCard key={a.id} alert={a} />)}</div>
        )}
      </section>

      <section className="section" aria-labelledby="dec-h">
        <div className="section-head">
          <h2 id="dec-h" className="h2">Ils attendent votre feu vert <span className="muted">· {approvals.length}</span></h2>
          <button type="button" className="link-btn" onClick={() => go("decisions")}>Tout voir →</button>
        </div>
        {approvals.length === 0 ? (
          <p className="sub">Rien à valider pour l'instant.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {approvals.slice(0, 4).map((p) => (
              <div key={p.id} className="decision-row">
                <Avatar id={p.agent_id} name={p.agent?.name ?? "?"} />
                <div className="meta">
                  <span className="t">{p.title}</span>
                  <span className="s">{p.agent?.name} · {p.reason}</span>
                </div>
                <div className="actions"><DecisionButtons approval={p} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.month.budget_cents && data.month.projection_cents > data.month.budget_cents && (
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", background: "#FFF4EE" }}>
          <Icon name="bell" />
          <span style={{ fontSize: 14 }}>
            À ce rythme, vous dépenserez <strong>{euros(data.month.projection_cents, 0)}</strong> ce mois-ci, au-delà de votre plafond de {euros(data.month.budget_cents, 0)}.
          </span>
        </div>
      )}
    </>
  );
}
