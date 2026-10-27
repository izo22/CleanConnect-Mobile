import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, LiveContext, api, session, useData, useLiveUpdates, type ActivityRow, type Me, type Overview } from "./api.ts";
import { AccountContext, canFor, roleLabel, useAccount, type Account } from "./account.tsx";
import { money, shortTime } from "./format.ts";
import { tr } from "./i18n.ts";
import { ErrorBox, Icon, Logo, Skeleton, ToastProvider, useToast } from "./components/ui.tsx";
import { Admin } from "./views/Admin.tsx";
import { Alerts } from "./views/Alerts.tsx";
import { Brief } from "./views/Brief.tsx";
import { Decisions } from "./views/Decisions.tsx";
import { Quality } from "./views/Quality.tsx";
import { Connections } from "./views/Connections.tsx";
import { EarlyAccess } from "./views/EarlyAccess.tsx";
import { Members } from "./views/Members.tsx";
import { Rules } from "./views/Rules.tsx";
import { LinkPage, Login, Setup } from "./views/SignIn.tsx";
import { Team } from "./views/Team.tsx";
import { PRODUCT_NAME } from "../../server/brand.ts";

export type View = "brief" | "team" | "alerts" | "decisions" | "quality" | "rules" | "connections" | "journal" | "members" | "admin" | "early-access";
const VIEWS: View[] = ["brief", "team", "alerts", "decisions", "quality", "rules", "connections", "journal", "members", "admin", "early-access"];

/** `#/team/invoice-reminders` → { view: "team", id: "invoice-reminders" } */
function parseHash(): { view: View; id: string | null } {
  const [, v, id] = window.location.hash.split("/");
  return { view: VIEWS.includes(v as View) ? (v as View) : "brief", id: id ? decodeURIComponent(id) : null };
}

/** `#/link/<token>`: an invitation or a password reset link. */
const linkToken = () => {
  const [, v, token] = window.location.hash.split("/");
  return v === "link" && token ? token : null;
};

type Gate = { kind: "checking" } | { kind: "setup" } | { kind: "login" } | { kind: "in"; me: Me } | { kind: "down"; message: string };

export function App() {
  const [gate, setGate] = useState<Gate>({ kind: "checking" });
  const [link, setLink] = useState(linkToken);

  const load = useCallback(async () => {
    try {
      setGate({ kind: "in", me: await api<Me>("/api/me") });
    } catch (e) {
      if ((e as ApiError).status !== 401) return setGate({ kind: "down", message: (e as Error).message });
      const state = await api<{ setup_needed: boolean }>("/api/auth/state").catch(() => ({ setup_needed: false }));
      setGate({ kind: state.setup_needed ? "setup" : "login" });
    }
  }, []);

  useEffect(() => {
    void load();
    const onHash = () => setLink(linkToken());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [load]);

  const signedIn = (me: Me) => setGate({ kind: "in", me });

  let screen: ReactNode;
  if (link) {
    screen = (
      <LinkPage token={link} onDone={(me, ws) => {
        if (ws) session.workspace = ws;
        window.location.hash = "#/brief";
        setLink(null);
        signedIn(me);
      }} />
    );
  } else if (gate.kind === "checking") screen = <div className="main"><div className="container"><Skeleton /></div></div>;
  else if (gate.kind === "down") screen = <div className="main"><div className="container"><ErrorBox message={gate.message} /></div></div>;
  else if (gate.kind === "setup") screen = <Setup onDone={signedIn} />;
  else if (gate.kind === "login") screen = <Login onDone={signedIn} />;
  else screen = <Signed me={gate.me} reload={load} onSignOut={() => setGate({ kind: "login" })} />;
  return <ToastProvider>{screen}</ToastProvider>;
}

function Signed({ me, reload, onSignOut }: { me: Me; reload: () => Promise<void>; onSignOut: () => void }) {
  const live = useLiveUpdates(true);
  const [wanted, setWanted] = useState(() => session.workspace);
  // The remembered workspace may be gone (access removed): fall back to the first one.
  const ws = me.workspaces.find((w) => w.id === wanted) ?? me.workspaces[0];
  if (ws && session.workspace !== ws.id) session.workspace = ws.id;

  // A change elsewhere (new role, removed access…) shows up without reloading the page.
  useEffect(() => {
    if (live.version) void reload();
  }, [live.version, reload]);

  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
    onSignOut();
  }, [onSignOut]);

  const account = useMemo<Account | null>(
    () =>
      ws
        ? {
            me, ws, can: canFor(ws.role), reload, signOut,
            switchTo: (id: string) => {
              session.workspace = id;
              setWanted(id);
              window.location.hash = "#/brief";
            },
          }
        : null,
    [me, ws, reload, signOut],
  );

  if (!account) return <NoWorkspace me={me} reload={reload} signOut={signOut} />;
  return (
    <AccountContext.Provider value={account}>
      <LiveContext.Provider value={live}>
        {/* A new key remounts every page, so each one reloads its data for the new workspace. */}
        <Shell key={account.ws.id} connected={live.connected} />
      </LiveContext.Provider>
    </AccountContext.Provider>
  );
}

function NoWorkspace({ me, reload, signOut }: { me: Me; reload: () => Promise<void>; signOut: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{ padding: 0 }}><Logo /> {PRODUCT_NAME}</div>
        <h1 className="h2">{tr(`Hello ${me.user.name}`, `Bonjour ${me.user.name}`)}</h1>
        <p className="sub" style={{ fontSize: 14, lineHeight: 1.5 }}>
          {tr(
            "You don't belong to any workspace yet. Ask the person who works with you to send you an invitation link.",
            "Vous ne faites encore partie d'aucun espace. Demandez à la personne avec qui vous travaillez de vous envoyer un lien d'invitation.",
          )}
        </p>
        {me.user.is_admin && <button type="button" className="btn primary big" onClick={() => setCreating(true)}>{tr("Create a workspace", "Créer un espace")}</button>}
        <button type="button" className="btn big" onClick={() => void signOut()}>{tr("Sign out", "Se déconnecter")}</button>
      </div>
      {creating && <NewWorkspace onClose={() => setCreating(false)} onCreated={(id) => { session.workspace = id; void reload(); }} />}
    </div>
  );
}

function Shell({ connected }: { connected: boolean }) {
  const { me, switchTo, reload } = useAccount();
  const [route, setRoute] = useState(parseHash);
  const [modal, setModal] = useState<"workspace" | "password" | null>(null);
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
  const admin = me.user.is_admin;
  const canCreate = admin || me.workspaces.some((w) => w.role === "owner");
  // Platform pages are for the administrator only.
  const view = !admin && (route.view === "admin" || route.view === "early-access") ? "brief" : route.view;

  const item = (v: View, icon: Parameters<typeof Icon>[0]["name"], label: string, extra?: ReactNode) => (
    <button type="button" className="nav-item" aria-current={view === v ? "page" : undefined} onClick={() => go(v)}>
      <Icon name={icon} />
      <span className="label">{label}</span>
      {extra}
    </button>
  );

  return (
    <div className="shell">
      <nav className="sidebar" aria-label={tr("Main navigation", "Navigation principale")}>
        <div className="brand"><Logo /> {PRODUCT_NAME}</div>
        <WorkspaceSwitcher canCreate={canCreate} onNew={() => setModal("workspace")} />
        <div className="nav">
          {item("brief", "sun", tr("Morning brief", "Brief du matin"))}
          {item("team", "team", tr("My AI team", "Mon équipe IA"), data && <span className="count">{data.counts.total}</span>)}
          {item("alerts", "bell", tr("Alerts", "Alertes"), alerts > 0 && <span className="badge hot">{alerts}</span>)}
          {item("decisions", "check", tr("Decisions", "Décisions"), pending > 0 && <span className="badge">{pending}</span>)}
          {item("quality", "eye", tr("Quality", "Qualité"), flagged > 0 && <span className="badge hot">{flagged}</span>)}
          {item("rules", "shield", tr("Guardrails", "Garde-fous"))}
          {item("connections", "plug", tr("Connections", "Connexions"))}
          {item("journal", "journal", tr("Log", "Journal"))}
          {item("members", "members", tr("Members", "Membres"))}
          {admin && item("admin", "grid", tr("Administration", "Administration"))}
          {admin && item("early-access", "inbox", tr("Early access", "Demandes d'accès"), me.early_access > 0 && <span className="count">{me.early_access}</span>)}
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
        <AccountBox onPassword={() => setModal("password")} />
        <div className="live"><span className={"live-dot" + (connected ? "" : " off")} />{connected ? tr("Live", "En direct") : tr("Reconnecting…", "Reconnexion…")}</div>
      </nav>
      <main className="main">
        <div className="container">
          {view === "brief" && <Brief go={go} />}
          {view === "team" && <Team selected={route.id} onSelect={(id) => go("team", id)} />}
          {view === "alerts" && <Alerts />}
          {view === "decisions" && <Decisions />}
          {view === "quality" && <Quality />}
          {view === "rules" && <Rules />}
          {view === "connections" && <Connections />}
          {view === "journal" && <Journal />}
          {view === "members" && <Members />}
          {view === "admin" && <Admin />}
          {view === "early-access" && <EarlyAccess />}
        </div>
      </main>
      {modal === "workspace" && (
        <NewWorkspace onClose={() => setModal(null)} onCreated={async (id) => {
          await reload();
          switchTo(id);
          // A new client workspace: the next step is inviting the client.
          window.location.hash = "#/members";
        }} />
      )}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} />}
    </div>
  );
}

const NEW = "__new";

function WorkspaceSwitcher({ canCreate, onNew }: { canCreate: boolean; onNew: () => void }) {
  const { me, ws, switchTo } = useAccount();
  return (
    <div className="ws-switch">
      <label htmlFor="ws-select">{tr("Workspace", "Espace")}</label>
      <select id="ws-select" value={ws.id} onChange={(e) => (e.target.value === NEW ? onNew() : switchTo(e.target.value))}>
        {me.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        {canCreate && <option value={NEW}>{tr("+ New workspace…", "+ Nouvel espace…")}</option>}
      </select>
      <span className="role">{tr("Your role: ", "Votre rôle : ")}{roleLabel(ws.role)}</span>
    </div>
  );
}

function AccountBox({ onPassword }: { onPassword: () => void }) {
  const { me, signOut } = useAccount();
  if (me.mode === "open") return null;
  return (
    <div className="account-box">
      <div className="who-am-i">
        <strong>{me.user.name}</strong>
        <span>{me.user.email}</span>
      </div>
      <div className="actions">
        <button type="button" className="btn small" onClick={onPassword}>{tr("Password", "Mot de passe")}</button>
        <button type="button" className="btn small" onClick={() => void signOut()}>{tr("Sign out", "Se déconnecter")}</button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit: (e: FormEvent) => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-h" onSubmit={onSubmit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 id="modal-h" className="h2">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={tr("Close", "Fermer")}><Icon name="close" size={16} /></button>
        </div>
        {children}
      </form>
    </div>
  );
}

function NewWorkspace({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const w = await api<{ id: string; name: string }>("/api/workspaces", { method: "POST", body: { name: name.trim() } });
      toast(tr(`Workspace “${w.name}” created. Invite your client below.`, `Espace « ${w.name} » créé. Invitez votre client ci-dessous.`));
      onClose();
      onCreated(w.id);
    } catch (err) {
      toast((err as Error).message, true);
      setBusy(false);
    }
  };
  return (
    <Modal title={tr("New workspace", "Nouvel espace")} onClose={onClose} onSubmit={submit}>
      <p className="sub" style={{ fontSize: 14, lineHeight: 1.5 }}>
        {tr(
          "One workspace per client: their agents, alerts, decisions and guardrails stay separate, and they only see their own.",
          "Un espace par client : ses agents, alertes, décisions et garde-fous restent à part, et il ne voit que les siens.",
        )}
      </p>
      <div className="field">
        <label htmlFor="new-ws">{tr("Name", "Nom")}</label>
        <input id="new-ws" required autoFocus maxLength={80} placeholder={tr("e.g. Acme Corp", "ex. Boulangerie Martin")} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn big" onClick={onClose}>{tr("Cancel", "Annuler")}</button>
        <button type="submit" className="btn primary big" disabled={busy || !name.trim()}>{busy ? "…" : tr("Create", "Créer")}</button>
      </div>
    </Modal>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ message: string }>("/api/me/password", { method: "POST", body: f });
      toast(res.message);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title={tr("Change your password", "Changer de mot de passe")} onClose={onClose} onSubmit={submit}>
      <div className="field">
        <label htmlFor="pw-current">{tr("Current password", "Mot de passe actuel")}</label>
        <input id="pw-current" type="password" required autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="pw-next">{tr("New password", "Nouveau mot de passe")}</label>
        <input id="pw-next" type="password" required minLength={10} autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} aria-describedby="pw-hint" />
        <span id="pw-hint" className="hint">{tr("At least 10 characters.", "Au moins 10 caractères.")}</span>
      </div>
      {error && <span className="form-error" role="alert">{error}</span>}
      <div className="actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn big" onClick={onClose}>{tr("Cancel", "Annuler")}</button>
        <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Save", "Enregistrer")}</button>
      </div>
    </Modal>
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

