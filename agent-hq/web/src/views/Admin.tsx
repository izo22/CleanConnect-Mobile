import { useState, type FormEvent } from "react";
import { api, useData } from "../api.ts";
import { useAccount } from "../account.tsx";
import { plural } from "../format.ts";
import { locale, tr } from "../i18n.ts";
import { CopyLink, ErrorBox, Skeleton, useToast } from "../components/ui.tsx";

interface WorkspaceRow { id: string; name: string; created_at: number; members: number; agents: number; owners: string | null }

/** The platform administrator's page: every client workspace, and help for locked-out people. */
export function Admin() {
  const { me, ws, switchTo } = useAccount();
  const { data, error } = useData<WorkspaceRow[]>("/api/admin/workspaces");
  const mine = new Set(me.workspaces.map((w) => w.id));

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("Administration", "Administration")}</h1>
          <span className="sub">
            {tr(
              "Every client workspace on this server. You only see a workspace's agents and data if you are one of its members.",
              "Tous les espaces clients de ce serveur. Vous ne voyez les agents et les données d'un espace que si vous en êtes membre.",
            )}
          </span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={1} />}
      {data && (
        <section className="section" aria-labelledby="ws-h">
          <h2 id="ws-h" className="h2" style={{ fontSize: 22 }}>{tr(`Workspaces (${data.length})`, `Espaces (${data.length})`)}</h2>
          <div className="card list">
            {data.map((w) => (
              <div key={w.id} className="list-row">
                <div className="grow">
                  <strong>{w.name}</strong>
                  <span className="muted">
                    {tr("Owners: ", "Propriétaires : ")}{w.owners ?? tr("none", "aucun")} · {plural(w.members, tr("member", "membre"), tr("members", "membres"))} · {plural(w.agents, "agent", "agents")} ·{" "}
                    {tr("since ", "depuis le ")}{new Date(w.created_at).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {mine.has(w.id) && w.id !== ws.id && <button type="button" className="btn small" onClick={() => switchTo(w.id)}>{tr("Open", "Ouvrir")}</button>}
              </div>
            ))}
          </div>
        </section>
      )}
      <ResetLink />
    </>
  );
}

function ResetLink() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ link: string; email: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ link: string }>("/api/admin/reset-link", { method: "POST", body: { email: email.trim() } });
      setCreated({ link: res.link, email: email.trim() });
      setEmail("");
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" aria-labelledby="reset-h" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 id="reset-h" className="h2" style={{ fontSize: 22 }}>{tr("Someone forgot their password", "Quelqu'un a oublié son mot de passe")}</h2>
        <span className="sub" style={{ fontSize: 14 }}>
          {tr("Create a reset link and send it to them. It works once, for 7 days, and signs them out everywhere else.", "Créez un lien de réinitialisation et envoyez-le-lui. Il sert une fois, pendant 7 jours, et le déconnecte partout ailleurs.")}
        </span>
      </div>
      <form className="inline-form" onSubmit={submit}>
        <div className="field grow">
          <label htmlFor="reset-email">{tr("Their email", "Son e-mail")}</label>
          <input id="reset-email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn big" disabled={busy || !email.trim()}>{busy ? "…" : tr("Create a reset link", "Créer un lien")}</button>
      </form>
      {created && <CopyLink link={created.link} intro={<>{tr("Send this link to ", "Envoyez ce lien à ")}<b>{created.email}</b>.</>} />}
    </section>
  );
}
