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

/** Google's own "G", as its sign-in button guidelines ask. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Full-page navigation: Google sends the person back to the server, which signs them in. */
function GoogleButton({ consent = false }: { consent?: boolean }) {
  return (
    <>
      <a className="btn-google" href="/api/auth/google/start"><GoogleG /> {tr("Continue with Google", "Continuer avec Google")}</a>
      {/* From the log-in page, Google can also create an account. */}
      {consent && <Consent />}
      <div className="or" role="separator"><span>{tr("or with your email", "ou avec votre e-mail")}</span></div>
    </>
  );
}

/** Why a Google sign-in came back without signing in (#/auth-error/<code>). */
export function authErrorMessage(code: string) {
  switch (code) {
    case "cancelled": return tr("Google sign-in was cancelled.", "La connexion avec Google a été annulée.");
    case "expired": return tr("The Google sign-in took too long or came from another browser. Please try again.", "La connexion avec Google a pris trop de temps ou vient d'un autre navigateur. Réessayez.");
    case "unverified": return tr("Google hasn't verified this email address yet.", "Google n'a pas encore vérifié cette adresse e-mail.");
    case "no-account": return tr("No Orvanta account uses this Google email. Ask for an invitation.", "Aucun compte Orvanta n'utilise cet e-mail Google. Demandez une invitation.");
    case "busy": return tr("Too many sign-ups right now. Please try again in an hour.", "Trop d'inscriptions pour le moment. Réessayez dans une heure.");
    default: return tr("Google didn't answer. Please try again.", "Google n'a pas répondu. Réessayez.");
  }
}

/** The legal pages live on the public site: app.example.com → example.com. */
const siteUrl = (path: string) => {
  const host = window.location.hostname;
  return host.startsWith("app.") ? `https://${host.slice(4)}${path}` : `https://orvantahq.io${path}`;
};

function Consent() {
  return (
    <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
      {tr("By creating an account, you agree to the ", "En créant un compte, vous acceptez les ")}
      <a href={siteUrl("/terms")} target="_blank" rel="noreferrer">{tr("Terms of Service", "conditions d'utilisation")}</a>
      {tr(" and the ", " et la ")}
      <a href={siteUrl("/privacy")} target="_blank" rel="noreferrer">{tr("Privacy Policy", "politique de confidentialité")}</a>.
    </span>
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

export function Login({ onDone, signup, google, notice }: { onDone: (me: Me) => void; signup: boolean; google: boolean; notice?: string }) {
  const [f, setF] = useState({ email: "", password: "" });
  const { busy, error, submit } = useSubmit(() => api<Me>("/api/auth/login", { method: "POST", body: f }), onDone);
  return (
    <AuthCard title={tr("Log in", "Connexion")} error={error || notice} onSubmit={submit}>
      {google && <GoogleButton consent={signup} />}
      <Field id="login-email" label={tr("Email", "E-mail")} type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Field id="login-password" label={tr("Password", "Mot de passe")} type="password" required autoComplete="current-password" value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })} />
      <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Log in", "Se connecter")}</button>
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
export function Signup({ onDone, google }: { onDone: (me: Me) => void; google: boolean }) {
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
      {google && <GoogleButton />}
      <Field id="su-name" label={tr("Your name", "Votre nom")} required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field id="su-company" label={tr("Company (optional)", "Société (facultatif)")} autoComplete="organization" maxLength={80} value={f.company}
        onChange={(e) => setF({ ...f, company: e.target.value })} hint={tr("It names your workspace. You can change it later.", "Elle donne son nom à votre espace. Modifiable ensuite.")} />
      <Field id="su-email" label={tr("Work email", "E-mail professionnel")} type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Field id="su-password" label={tr("Password", "Mot de passe")} type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })} hint={passwordHint()} />
      {/* Hidden from people; bots fill it in. */}
      <input className="hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Create my account", "Créer mon compte")}</button>
      <Consent />
      <span style={{ fontSize: 14 }}>
        {tr("Already have an account? ", "Déjà un compte ? ")}<a href="#/">{tr("Log in", "Connectez-vous")}</a>
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
  signed_in: boolean;
}

/** Opened from an invitation or a password reset link: #/link/<token>. */
export function LinkPage({ token, onDone }: { token: string; onDone: (me: Me, workspaceId: string | null) => void }) {
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [broken, setBroken] = useState("");
  const [f, setF] = useState({ name: "", password: "" });
  useEffect(() => {
    api<LinkInfo>(`/api/auth/link/${encodeURIComponent(token)}`).then(setInfo).catch((e) => setBroken((e as Error).message));
  }, [token]);
  const body = info?.kind === "invite" && info.signed_in ? {} : info?.kind === "invite" && info.account_exists ? { password: f.password } : info?.kind === "reset" ? { password: f.password } : f;
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
      {info.signed_in ? (
        <>
          <span className="explain">{tr(`You're signed in as ${info.email}.`, `Vous êtes connecté en tant que ${info.email}.`)}</span>
          <button type="submit" className="btn primary big" disabled={busy}>{busy ? "…" : tr("Join", "Rejoindre")}</button>
        </>
      ) : info.account_exists ? (
        <>
          <span className="explain">{tr(`You already have an account with ${info.email}. Enter its password to add this workspace to it.`, `Vous avez déjà un compte avec ${info.email}. Entrez son mot de passe pour y ajouter cet espace.`)}</span>
          <input type="email" hidden readOnly autoComplete="username" value={info.email} />
          <Field id="join-password" label={tr("Your password", "Votre mot de passe")} type="password" required autoComplete="current-password"
            value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
            hint={tr("You signed up with Google? Log in with Google first, then open this link again.", "Inscrit avec Google ? Connectez-vous d'abord avec Google, puis rouvrez ce lien.")} />
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
          <Consent />
        </>
      )}
    </AuthCard>
  );
}
