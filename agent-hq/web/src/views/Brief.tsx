import { useData, type Overview } from "../api.ts";
import { many, money, num, plural } from "../format.ts";
import { locale, tr } from "../i18n.ts";
import { AlertCard, Avatar, DecisionButtons, ErrorBox, Icon, Ring, Skeleton } from "../components/ui.tsx";
import type { View } from "../App.tsx";
import { useAccount } from "../account.tsx";
import { PRODUCT_NAME } from "../../../server/brand.ts";

export function Brief({ go }: { go: (v: View) => void }) {
  const { data, error } = useData<Overview>("/api/overview");
  if (error) return <ErrorBox message={error.message} />;
  if (!data) return <Skeleton />;

  const { counts, alerts, approvals } = data;
  if (counts.total === 0) return <GettingStarted go={go} />;
  const todo = alerts.length + approvals.length;
  const hours = data.minutes_saved_24h / 60;
  const delta = data.cost_avg_day_cents ? (data.cost_24h_cents - data.cost_avg_day_cents) / data.cost_avg_day_cents : 0;
  const date = new Date(data.now).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="brief-top">
        <section className="hero" aria-label={tr("Summary", "Résumé")}>
          <div className="text">
            <span className="date">{date}</span>
            <h1>
              {tr("Hello!", "Bonjour !")}<br />
              {todo === 0
                ? tr("Nothing needs you.", "Rien ne vous attend.")
                : many(todo)
                  ? tr(`${todo} things need you.`, `${todo} choses vous attendent.`)
                  : tr(`${todo} thing needs you.`, `${todo} chose vous attend.`)}
            </h1>
            <span className="fleet">
              {tr(`${counts.attention} need a look`, `${counts.attention} à surveiller`)} · {plural(counts.blocked, tr("blocked", "bloqué"), tr("blocked", "bloqués"))} · {tr(`${counts.paused} paused`, `${counts.paused} en pause`)}
            </span>
          </div>
          <Ring value={counts.ok} total={counts.total} label={tr("healthy", "en forme")} />
        </section>
        <div className="kpis">
          <div className="kpi violet">
            <span className="k">{tr("Tasks done", "Tâches réalisées")}</span>
            <span className="v">{num(data.tasks_24h)}</span>
            <span className="h">{tr("last 24 hours", "dernières 24 h")}</span>
          </div>
          <div className="kpi green">
            <span className="k">{tr("Time saved", "Temps gagné")}</span>
            <span className="v">{tr(`${num(hours)} hrs`, `${num(hours)} h`)}</span>
            <span className="h">≈ {tr(`${num(hours / 7)} full-time people`, `${num(hours / 7)} personnes à temps plein`)}</span>
          </div>
          <div className="kpi coral">
            <span className="k">{tr("Cost, last 24 hours", "Coût des 24 h")}</span>
            <span className="v">{money(data.cost_24h_cents, 0)}</span>
            <span className="h">{delta >= 0 ? "+" : ""}{tr(`${Math.round(delta * 100)}% vs average`, `${Math.round(delta * 100)} % vs moyenne`)}</span>
          </div>
          <div className="kpi white">
            <span className="k">{tr("At work", "Au travail")}</span>
            <span className="v">{counts.total - counts.paused - counts.blocked}<small> /{counts.total}</small></span>
            <span className="h">{tr("active agents", "agents actifs")}</span>
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="todo-h">
        <div className="section-head">
          <h2 id="todo-h" className="h2">{tr("To handle today", "À traiter aujourd'hui")}</h2>
          {alerts.length > 3 && (
            <button type="button" className="link-btn" onClick={() => go("alerts")}>{tr(`See all ${alerts.length} alerts →`, `Voir les ${alerts.length} alertes →`)}</button>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="all-clear">
            <span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B3B24" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
            <div>
              <strong>{tr("All good.", "Tout roule.")}</strong>
              <span>{tr("No open incidents. We'll let you know if that changes.", "Aucun incident ouvert. On vous prévient si ça change.")}</span>
            </div>
          </div>
        ) : (
          <div className="grid-cards">{alerts.slice(0, 3).map((a) => <AlertCard key={a.id} alert={a} />)}</div>
        )}
      </section>

      <section className="section" aria-labelledby="dec-h">
        <div className="section-head">
          <h2 id="dec-h" className="h2">{tr("Waiting for your go-ahead", "Ils attendent votre feu vert")} <span className="muted">· {approvals.length}</span></h2>
          <button type="button" className="link-btn" onClick={() => go("decisions")}>{tr("See all →", "Tout voir →")}</button>
        </div>
        {approvals.length === 0 ? (
          <p className="sub">{tr("Nothing to approve right now.", "Rien à valider pour l'instant.")}</p>
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
            {tr("At this pace, you will spend ", "À ce rythme, vous dépenserez ")}
            <strong>{money(data.month.projection_cents, 0)}</strong>
            {tr(` this month, over your cap of ${money(data.month.budget_cents, 0)}.`, ` ce mois-ci, au-delà de votre plafond de ${money(data.month.budget_cents, 0)}.`)}
          </span>
        </div>
      )}
    </>
  );
}

/** A new workspace has no agents yet: show the three ways to bring them in. */
function GettingStarted({ go }: { go: (v: View) => void }) {
  const { me, ws, can } = useAccount();
  const steps: Array<{ title: string; text: string; action: string; view: View }> = [
    {
      title: tr("Connect n8n", "Connecter n8n"),
      text: tr("Paste your n8n address and an API key: every workflow shows up as an agent, and “Pause” really switches it off.", "Collez l'adresse de votre n8n et une clé API : chaque workflow devient un agent, et « Pause » le coupe vraiment."),
      action: tr("Connect n8n", "Connecter n8n"),
      view: "connections",
    },
    {
      title: tr("Add Zapier or your own code", "Ajouter Zapier ou votre code"),
      text: tr("Create an agent, copy its key, and add the Orvanta steps to your Zaps or a few lines to your code.", "Créez un agent, copiez sa clé, puis ajoutez les étapes Orvanta à vos Zaps ou quelques lignes à votre code."),
      action: tr("Add an agent", "Ajouter un agent"),
      view: "team",
    },
    {
      title: tr("Invite your team", "Inviter votre équipe"),
      text: tr("Colleagues or clients get their own sign-in. Viewers can approve decisions without touching settings.", "Collègues ou clients ont leur propre connexion. Les lecteurs approuvent les décisions sans toucher aux réglages."),
      action: tr("Invite people", "Inviter"),
      view: "members",
    },
  ];
  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr(`Welcome, ${me.user.name.split(" ")[0]}`, `Bienvenue, ${me.user.name.split(" ")[0]}`)}</h1>
          <span className="sub">
            {tr(
              `“${ws.name}” has no agents yet. Bring them in and ${PRODUCT_NAME} starts watching right away.`,
              `« ${ws.name} » n'a pas encore d'agents. Ajoutez-les et ${PRODUCT_NAME} commence à les surveiller tout de suite.`,
            )}
          </span>
        </div>
      </header>
      <div className="grid-cards">
        {steps.map((s, i) => (
          <article key={s.view} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="step-num">{i + 1}</span>
            <h2 className="h2" style={{ fontSize: 20 }}>{s.title}</h2>
            <p className="sub" style={{ fontSize: 14, lineHeight: 1.5 }}>{s.text}</p>
            {(s.view === "members" ? can("owner") : can("member")) && (
              <button type="button" className={"btn" + (i === 0 ? " primary" : "")} style={{ alignSelf: "flex-start", marginTop: "auto" }} onClick={() => go(s.view)}>
                {s.action}
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
