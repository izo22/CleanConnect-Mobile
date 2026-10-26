import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LiveContext, api, session, useData, useLiveUpdates, type ActivityRow, type Overview } from "./api.ts";
import { euros, shortTime } from "./format.ts";
import { ErrorBox, Icon, Logo, Skeleton, ToastProvider } from "./components/ui.tsx";
import { Alerts } from "./views/Alerts.tsx";
import { Brief } from "./views/Brief.tsx";
import { Decisions } from "./views/Decisions.tsx";
import { Quality } from "./views/Quality.tsx";
import { Connections } from "./views/Connections.tsx";
import { Rules } from "./views/Rules.tsx";
import { Team } from "./views/Team.tsx";

export type View = "brief" | "team" | "alerts" | "decisions" | "quality" | "rules" | "connections" | "journal";
const VIEWS: View[] = ["brief", "team", "alerts", "decisions", "quality", "rules", "connections", "journal"];

/** `#/team/relance-factures` → { view: "team", id: "relance-factures" } */
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
      <nav className="sidebar" aria-label="Navigation principale">
        <div className="brand"><Logo /> Agent HQ</div>
        <div className="nav">
          {item("brief", "sun", "Brief du matin")}
          {item("team", "team", "Mon équipe IA", data && <span className="count">{data.counts.total}</span>)}
          {item("alerts", "bell", "Alertes", alerts > 0 && <span className="badge hot">{alerts}</span>)}
          {item("decisions", "check", "Décisions", pending > 0 && <span className="badge">{pending}</span>)}
          {item("quality", "eye", "Qualité", flagged > 0 && <span className="badge hot">{flagged}</span>)}
          {item("rules", "shield", "Garde-fous")}
          {item("connections", "plug", "Connexions")}
          {item("journal", "journal", "Journal")}
        </div>
        {month && (
          <div className="budget-card">
            <span className="k">Budget IA du mois</span>
            <span className="v">{euros(month.spent_cents, 0)} {month.budget_cents ? <small>/ {euros(month.budget_cents, 0)}</small> : null}</span>
            {month.budget_cents ? (
              <div className="bar" style={{ height: 8, background: "#fff" }}><div style={{ width: `${Math.min(100, (month.spent_cents / month.budget_cents) * 100)}%` }} /></div>
            ) : null}
            <span className="hint">Projection fin de mois : {euros(month.projection_cents, 0)}</span>
          </div>
        )}
        <div className="live"><span className={"live-dot" + (connected ? "" : " off")} />{connected ? "En direct" : "Reconnexion…"}</div>
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
          <h1 className="h1">Journal</h1>
          <span className="sub">Qui a fait quoi, humains et agents. Tout est tracé.</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={1} />}
      {data && (
        <div className="card timeline">
          {data.length === 0 && <span className="muted">Rien pour l'instant.</span>}
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
        <div className="brand" style={{ padding: 0 }}><Logo /> Agent HQ</div>
        <h1 id="login-h" className="h2">Connexion</h1>
        <div className="field"><label htmlFor="name">Votre prénom</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /><span className="hint">Il apparaît dans le journal quand vous agissez.</span></div>
        <div className="field"><label htmlFor="tok">Code d'accès</label><input id="tok" type="password" required value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" /></div>
        {error && <span style={{ color: "#B42318", fontSize: 14 }}>{error}</span>}
        <button type="submit" className="btn primary big">Entrer</button>
      </form>
    </div>
  );
}
