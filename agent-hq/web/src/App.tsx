import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LiveContext, api, session, useData, useLiveUpdates, type ActivityRow, type Overview } from "./api.ts";
import { money, shortTime } from "./format.ts";
import { tr } from "./i18n.ts";
import { ErrorBox, Icon, Logo, Skeleton, ToastProvider } from "./components/ui.tsx";
import { Alerts } from "./views/Alerts.tsx";
import { Brief } from "./views/Brief.tsx";
import { Decisions } from "./views/Decisions.tsx";
import { Quality } from "./views/Quality.tsx";
import { Connections } from "./views/Connections.tsx";
import { Rules } from "./views/Rules.tsx";
import { Team } from "./views/Team.tsx";
import { PRODUCT_NAME } from "../../server/brand.ts";

export type View = "brief" | "team" | "alerts" | "decisions" | "quality" | "rules" | "connections" | "journal";
const VIEWS: View[] = ["brief", "team", "alerts", "decisions", "quality", "rules", "connections", "journal"];

/** `#/team/invoice-reminders` → { view: "team", id: "invoice-reminders" } */
function parseHash(): { view: View; id: string | null } {
  const [, v, id] = window.location.hash.split("/");
  return { view: VIEWS.includes(v as View) ? (v as View) : "brief", id: id ? decodeURIComponent(id) : null };
}

export function App() {
  const [auth, setAuth] = useState<"checking" | "ok" | "needed">("checking");
  useEffect(() => {
    api("/api/overview").then(() => setAuth("ok")).catch((e) => setAuth(e.status === 401 ? "needed" : "ok"));
  }, []);
  const live = useLiveUpdates(auth === "ok");

  if (auth === "checking") return <div className="main"><div className="container"><Skeleton /></div></div>;
  if (auth === "needed") return <Login onDone={() => setAuth("ok")} />;
  return (
    <LiveContext.Provider value={live}>
      <ToastProvider>
        <Shell connected={live.connected} />
      </ToastProvider>
    </LiveContext.Provider>
  );
}

function Shell({ connected }: { connected: boolean }) {
  const [route, setRoute] = useState(parseHash);
  const { data } = useData<Overview>("/api/overview");

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (view: View, id: string | null = null) => {
    window.location.hash = `/${view}${id ? "/" + encodeURIComponent(id) : ""}`;
    if (view !== route.view) window.scrollTo({ top: 0 });
  };

  const alerts = data?.alerts.length ?? 0;
  const pending = data?.approvals.length ?? 0;
  const flagged = data?.quality_flagged ?? 0;
  const month = data?.month;

  const item = (view: View, icon: Parameters<typeof Icon>[0]["name"], label: string, extra?: ReactNode) => (
    <button type="button" className="nav-item" aria-current={route.view === view ? "page" : undefined} onClick={() => go(view)}>
      <Icon name={icon} />
      <span className="label">{label}</span>
      {extra}
    </button>
  );

  return (
    <div className="shell">
      <nav className="sidebar" aria-label={tr("Main navigation", "Navigation principale")}>
        <div className="brand"><Logo /> {PRODUCT_NAME}</div>
        <div className="nav">
          {item("brief", "sun", tr("Morning brief", "Brief du matin"))}
          {item("team", "team", tr("My AI team", "Mon équipe IA"), data && <span className="count">{data.counts.total}</span>)}
          {item("alerts", "bell", tr("Alerts", "Alertes"), alerts > 0 && <span className="badge hot">{alerts}</span>)}
          {item("decisions", "check", tr("Decisions", "Décisions"), pending > 0 && <span className="badge">{pending}</span>)}
          {item("quality", "eye", tr("Quality", "Qualité"), flagged > 0 && <span className="badge hot">{flagged}</span>)}
          {item("rules", "shield", tr("Guardrails", "Garde-fous"))}
          {item("connections", "plug", tr("Connections", "Connexions"))}
          {item("journal", "journal", tr("Log", "Journal"))}
        </div>
        {month && (
          <div className="budget-card">
            <span className="k">{tr("AI budget this month", "Budget IA du mois")}</span>
            <span className="v">{money(month.spent_cents, 0)} {month.budget_cents ? <small>/ {money(month.budget_cents, 0)}</small> : null}</span>
            {month.budget_cents ? (
              <div className="bar" style={{ height: 8, background: "#fff" }}><div style={{ width: `${Math.min(100, (month.spent_cents / month.budget_cents) * 100)}%` }} /></div>
            ) : null}
            <span className="hint">{tr("Month-end projection: ", "Projection fin de mois : ")}{money(month.projection_cents, 0)}</span>
          </div>
        )}
        <div className="live"><span className={"live-dot" + (connected ? "" : " off")} />{connected ? tr("Live", "En direct") : tr("Reconnecting…", "Reconnexion…")}</div>
      </nav>
      <main className="main">
        <div className="container">
          {route.view === "brief" && <Brief go={go} />}
          {route.view === "team" && <Team selected={route.id} onSelect={(id) => go("team", id)} />}
          {route.view === "alerts" && <Alerts />}
          {route.view === "decisions" && <Decisions />}
          {route.view === "quality" && <Quality />}
          {route.view === "rules" && <Rules />}
          {route.view === "connections" && <Connections />}
          {route.view === "journal" && <Journal />}
        </div>
      </main>
    </div>
  );
}

function Journal() {
  const { data, error } = useData<ActivityRow[]>("/api/activity");
  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("Log", "Journal")}</h1>
          <span className="sub">{tr("Who did what, humans and agents. Everything is recorded.", "Qui a fait quoi, humains et agents. Tout est tracé.")}</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={1} />}
      {data && (
        <div className="card timeline">
          {data.length === 0 && <span className="muted">{tr("Nothing yet.", "Rien pour l'instant.")}</span>}
          {data.map((x) => (
            <div key={x.id} className="it">
              <time dateTime={new Date(x.ts).toISOString()}>{shortTime(x.ts)}</time>
              <span><strong>{x.actor}</strong> · {x.message}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState("");
  const [name, setName] = useState(session.name);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    session.token = token.trim();
    session.name = name.trim();
    try {
      await api("/api/overview");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="modal-bg" style={{ background: "var(--ground)", backdropFilter: "none" }}>
      <form className="modal" onSubmit={submit} aria-labelledby="login-h">
        <div className="brand" style={{ padding: 0 }}><Logo /> {PRODUCT_NAME}</div>
        <h1 id="login-h" className="h2">{tr("Sign in", "Connexion")}</h1>
        <div className="field">
          <label htmlFor="name">{tr("Your first name", "Votre prénom")}</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          <span className="hint">{tr("It shows up in the log when you act.", "Il apparaît dans le journal quand vous agissez.")}</span>
        </div>
        <div className="field">
          <label htmlFor="tok">{tr("Access code", "Code d'accès")}</label>
          <input id="tok" type="password" required value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <span style={{ color: "#B42318", fontSize: 14 }}>{error}</span>}
        <button type="submit" className="btn primary big">{tr("Enter", "Entrer")}</button>
      </form>
    </div>
  );
}
