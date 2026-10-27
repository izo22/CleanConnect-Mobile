import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { api, type Me, type Role } from "../api.ts";
import { roleHelp, roleLabel } from "../account.tsx";
import { tr } from "../i18n.ts";
import { Logo } from "../components/ui.tsx";
import { PRODUCT_NAME } from "../../../server/brand.ts";

const MIN_PASSWORD = 10;

function AuthCard({ title, intro, error, children, onSubmit, labelledBy = "auth-h" }: {
  title: string; intro?: ReactNode; error?: string; children: ReactNode; onSubmit?: (e: FormEvent) => void; labelledBy?: string;
}) {
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit} aria-labelledby={labelledBy}>
        <div className="brand" style={{ padding: 0 }}><Logo /> {PRODUCT_NAME}</div>
        <h1 id={labelledBy} className="h2">{title}</h1>
        {intro && <p className="sub" style={{ fontSize: 14, lineHeight: 1.5 }}>{intro}</p>}
        {children}
        {error && <span className="form-error" role="alert">{error}</span>}
      </form>
    </div>
  );
}

function Field({ id, label, hint, ...input }: { id: string; label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...input} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
    </div>
  );
}

const passwordHint = () => tr(`At least ${MIN_PASSWORD} characters. A short sentence is easy to remember.`, `Au moins ${MIN_PASSWORD} caractères. Une petite phrase se retient facilement.`);

/** Runs a form submission and keeps the server's error message on screen. */
function useSubmit<T>(send: () => Promise<T>, done: (r: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      done(await send());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

/** First visit on a fresh server: the founder proves they own it with the setup code. */
export function Setup({ onDone }: { onDone: (me: Me) => void }) {
  const [f, setF] = useState({ setup_code: "", name: "", email: "", password: "" });
  const { busy, error, submit } = useSubmit(() => api<Me>("/api/auth/setup", { method: "POST", body: f }), onDone);
  return (
    <AuthCard
      title={tr("Create the first account", "Créer le premier compte")}
      intro={tr(
        "This account will run the platform: it creates your clients' workspaces and invites people into them.",
        "Ce compte administre la plateforme : il crée les espaces de vos clients et y invite des personnes.",
      )}
      error={error}
      onSubmit={submit}
    >
      <Field id="setup-code" label={tr("Setup code", "Code d'installation")} type="password" required autoComplete="off" value={f.setup_code}
        onChange={(e) => setF({ ...f, setup_code: e.target.value })}
        hint={tr("The ADMIN_TOKEN value in the server's .env file.", "La valeur ADMIN_TOKEN du fichier .env du serveur.")} />
      <Field id="setup-name" label={tr("Your name", "Votre nom")} required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field id="setup-email" label={tr("Email", "E-mail")} type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Field id="setup-password" label={tr("Password", "Mot de passe")} type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })} hint={passwordHint()} />
      <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Create my account", "Créer mon compte")}</button>
    </AuthCard>
  );
}

export function Login({ onDone, signup }: { onDone: (me: Me) => void; signup: boolean }) {
  const [f, setF] = useState({ email: "", password: "" });
  const { busy, error, submit } = useSubmit(() => api<Me>("/api/auth/login", { method: "POST", body: f }), onDone);
  return (
    <AuthCard title={tr("Sign in", "Connexion")} error={error} onSubmit={submit}>
      <Field id="login-email" label={tr("Email", "E-mail")} type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Field id="login-password" label={tr("Password", "Mot de passe")} type="password" required autoComplete="current-password" value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })} />
      <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Sign in", "Se connecter")}</button>
      {signup && (
        <span style={{ fontSize: 14 }}>
          {tr("New to Orvanta? ", "Nouveau sur Orvanta ? ")}<a href="#/signup">{tr("Create your account", "Créez votre compte")}</a>
        </span>
      )}
      <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        {tr(
          "Forgot your password? Ask the person who invited you, or the Orvanta team, for a reset link.",
          "Mot de passe oublié ? Demandez un lien de réinitialisation à la personne qui vous a invité, ou à l'équipe Orvanta.",
        )}
      </span>
    </AuthCard>
  );
}

/** Self sign-up: the person gets their own empty workspace and lands in it. */
export function Signup({ onDone }: { onDone: (me: Me) => void }) {
  const [f, setF] = useState({ name: "", company: "", email: "", password: "", website: "" });
  const { busy, error, submit } = useSubmit(() => api<Me>("/api/auth/signup", { method: "POST", body: f }), onDone);
  return (
    <AuthCard
      title={tr("Create your account", "Créez votre compte")}
      intro={tr(
        "Free during the beta. You get your own workspace: connect n8n or Zapier, then invite your team.",
        "Gratuit pendant la bêta. Vous obtenez votre propre espace : branchez n8n ou Zapier, puis invitez votre équipe.",
      )}
      error={error}
      onSubmit={submit}
    >
      <Field id="su-name" label={tr("Your name", "Votre nom")} required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field id="su-company" label={tr("Company (optional)", "Société (facultatif)")} autoComplete="organization" maxLength={80} value={f.company}
        onChange={(e) => setF({ ...f, company: e.target.value })} hint={tr("It names your workspace. You can change it later.", "Elle donne son nom à votre espace. Modifiable ensuite.")} />
      <Field id="su-email" label={tr("Work email", "E-mail professionnel")} type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Field id="su-password" label={tr("Password", "Mot de passe")} type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })} hint={passwordHint()} />
      {/* Hidden from people; bots fill it in. */}
      <input className="hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Create my account", "Créer mon compte")}</button>
      <span style={{ fontSize: 14 }}>
        {tr("Already have an account? ", "Déjà un compte ? ")}<a href="#/">{tr("Sign in", "Connectez-vous")}</a>
      </span>
    </AuthCard>
  );
}

interface LinkInfo {
  kind: "invite" | "reset";
  email: string;
  role: Role | null;
  workspace_id: string | null;
  workspace: string | null;
  account_exists: boolean;
}

/** Opened from an invitation or a password reset link: #/link/<token>. */
export function LinkPage({ token, onDone }: { token: string; onDone: (me: Me, workspaceId: string | null) => void }) {
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [broken, setBroken] = useState("");
  const [f, setF] = useState({ name: "", password: "" });
  useEffect(() => {
    api<LinkInfo>(`/api/auth/link/${encodeURIComponent(token)}`).then(setInfo).catch((e) => setBroken((e as Error).message));
  }, [token]);
  const body = info?.kind === "invite" && info.account_exists ? { password: f.password } : info?.kind === "reset" ? { password: f.password } : f;
  const { busy, error, submit } = useSubmit(
    () => api<Me>(`/api/auth/link/${encodeURIComponent(token)}`, { method: "POST", body }),
    (me) => onDone(me, info?.workspace_id ?? null),
  );
  const leave = () => { window.location.hash = "#/brief"; };

  if (broken) {
    return (
      <AuthCard title={tr("This link no longer works", "Ce lien ne fonctionne plus")} intro={broken}>
        <span className="muted" style={{ fontSize: 13 }}>{tr("Ask the person who sent it for a new one. Links work once, for 7 days.", "Demandez-en un nouveau à la personne qui vous l'a envoyé. Un lien sert une fois, pendant 7 jours.")}</span>
        <button type="button" className="btn big" onClick={leave}>{tr("Go to sign in", "Aller à la connexion")}</button>
      </AuthCard>
    );
  }
  if (!info) return <div className="auth-page"><div className="auth-card"><div className="skeleton" style={{ height: 160 }} /></div></div>;

  if (info.kind === "reset") {
    return (
      <AuthCard title={tr("Choose a new password", "Choisissez un nouveau mot de passe")} intro={tr(`For the account ${info.email}.`, `Pour le compte ${info.email}.`)} error={error} onSubmit={submit}>
        <input type="email" hidden readOnly autoComplete="username" value={info.email} />
        <Field id="reset-password" label={tr("New password", "Nouveau mot de passe")} type="password" required minLength={MIN_PASSWORD} autoComplete="new-password"
          value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} hint={passwordHint()} />
        <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Save and sign in", "Enregistrer et se connecter")}</button>
      </AuthCard>
    );
  }

  const role = info.role ?? "member";
  const intro = (
    <>
      {tr("You are invited as ", "Vous êtes invité en tant que ")}<b>{roleLabel(role)}</b>{tr(": ", " : ")}{roleHelp(role).toLowerCase()}
    </>
  );
  return (
    <AuthCard title={tr(`Join ${info.workspace ?? "the workspace"}`, `Rejoindre ${info.workspace ?? "l'espace"}`)} intro={intro} error={error} onSubmit={submit}>
      {info.account_exists ? (
        <>
          <span className="explain">{tr(`You already have an account with ${info.email}. Enter its password to add this workspace to it.`, `Vous avez déjà un compte avec ${info.email}. Entrez son mot de passe pour y ajouter cet espace.`)}</span>
          <input type="email" hidden readOnly autoComplete="username" value={info.email} />
          <Field id="join-password" label={tr("Your password", "Votre mot de passe")} type="password" required autoComplete="current-password"
            value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Join", "Rejoindre")}</button>
        </>
      ) : (
        <>
          <Field id="join-email" label={tr("Email", "E-mail")} type="email" readOnly autoComplete="username" value={info.email}
            hint={tr("You will sign in with this address.", "Vous vous connecterez avec cette adresse.")} />
          <Field id="join-name" label={tr("Your name", "Votre nom")} required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Field id="join-password" label={tr("Choose a password", "Choisissez un mot de passe")} type="password" required minLength={MIN_PASSWORD} autoComplete="new-password"
            value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} hint={passwordHint()} />
          <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Create my account and join", "Créer mon compte et rejoindre")}</button>
        </>
      )}
    </AuthCard>
  );
}
