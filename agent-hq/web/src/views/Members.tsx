import { useState, type FormEvent } from "react";
import { api, useData, type Role } from "../api.ts";
import { roleHelp, roleLabel, useAccount } from "../account.tsx";
import { ago } from "../format.ts";
import { tr } from "../i18n.ts";
import { Avatar, CopyLink, ErrorBox, Skeleton, useAction, useToast } from "../components/ui.tsx";

interface WorkspaceView {
  id: string;
  name: string;
  role: Role;
  you: number;
  members: Array<{ user_id: number; name: string; email: string; role: Role; created_at: number }>;
  invites: Array<{ id: number; email: string; role: Role; created_at: number; expires_at: number }>;
}

const ROLES: Role[] = ["owner", "member", "viewer"];

export function Members() {
  const { ws, can, reload: reloadMe } = useAccount();
  const { data, error, reload } = useData<WorkspaceView>("/api/workspace");
  const { run, busy } = useAction();
  const owner = can("owner");

  const leave = async (userId: number) => {
    if (!window.confirm(tr(`Leave “${ws.name}”? You will lose access to it.`, `Quitter « ${ws.name} » ? Vous n'y aurez plus accès.`))) return;
    if (await run("leave", `/api/workspace/members/${userId}`, undefined, "DELETE")) await reloadMe();
  };
  const remove = async (m: WorkspaceView["members"][number]) => {
    if (!window.confirm(tr(`Remove ${m.name} from “${ws.name}”?`, `Retirer ${m.name} de « ${ws.name} » ?`))) return;
    if (await run("rm" + m.user_id, `/api/workspace/members/${m.user_id}`, undefined, "DELETE")) reload();
  };
  const setRole = async (userId: number, role: Role) => {
    if (await run("role" + userId, `/api/workspace/members/${userId}`, { role }, "PATCH")) {
      reload();
      if (data && userId === data.you) await reloadMe();
    }
  };

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">{tr("Members", "Membres")}</h1>
          <span className="sub">{tr(`Who can see and run “${ws.name}”. Each client only ever sees their own workspace.`, `Qui peut voir et piloter « ${ws.name} ». Chaque client ne voit que son propre espace.`)}</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={1} />}
      {data && (
        <>
          {owner && <Rename current={data.name} onDone={() => { reload(); void reloadMe(); }} />}

          <section className="section" aria-labelledby="members-h">
            <h2 id="members-h" className="h2" style={{ fontSize: 22 }}>{tr(`People (${data.members.length})`, `Personnes (${data.members.length})`)}</h2>
            <div className="card list">
              {data.members.map((m) => (
                <div key={m.user_id} className="list-row">
                  <Avatar id={`u${m.user_id}`} name={m.name} size={40} />
                  <div className="grow">
                    <strong>{m.name}{m.user_id === data.you ? tr(" (you)", " (vous)") : ""}</strong>
                    <span className="muted">{m.email}</span>
                  </div>
                  {owner ? (
                    <select aria-label={tr(`Role of ${m.name}`, `Rôle de ${m.name}`)} className="role-select" value={m.role} disabled={busy !== null}
                      onChange={(e) => setRole(m.user_id, e.target.value as Role)}>
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  ) : (
                    <span className="pill" style={{ background: "var(--chip)" }}>{roleLabel(m.role)}</span>
                  )}
                  {m.user_id === data.you ? (
                    <button type="button" className="btn small" disabled={busy !== null} onClick={() => leave(m.user_id)}>{tr("Leave", "Quitter")}</button>
                  ) : owner ? (
                    <button type="button" className="btn small danger" disabled={busy !== null} onClick={() => remove(m)}>{tr("Remove", "Retirer")}</button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {owner && <Invite invites={data.invites} onChange={reload} />}

          <section className="card" aria-labelledby="roles-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 id="roles-h" className="h2" style={{ fontSize: 20 }}>{tr("What each role can do", "Ce que chaque rôle permet")}</h2>
            <div className="explain">
              {ROLES.map((r) => <span key={r}><strong>{roleLabel(r)}{tr(":", " :")}</strong> {roleHelp(r)}</span>)}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Rename({ current, onDone }: { current: string; onDone: () => void }) {
  const [name, setName] = useState(current);
  const { run, busy } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run("rename", "/api/workspace", { name: name.trim() }, "PATCH")) onDone();
  };
  return (
    <form className="card inline-form" onSubmit={submit}>
      <div className="field grow">
        <label htmlFor="ws-name">{tr("Workspace name", "Nom de l'espace")}</label>
        <input id="ws-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button type="submit" className="btn" disabled={busy !== null || !name.trim() || name.trim() === current}>{tr("Rename", "Renommer")}</button>
    </form>
  );
}

function Invite({ invites, onChange }: { invites: WorkspaceView["invites"]; onChange: () => void }) {
  const { ws } = useAccount();
  const toast = useToast();
  const { run, busy } = useAction();
  const [f, setF] = useState<{ email: string; role: Role }>({ email: "", role: "member" });
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<{ link: string; email: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api<{ link: string; email: string }>("/api/workspace/invites", { method: "POST", body: { email: f.email.trim(), role: f.role } });
      setCreated(res);
      setF({ ...f, email: "" });
      onChange();
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="card" aria-labelledby="invite-h" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 id="invite-h" className="h2" style={{ fontSize: 22 }}>{tr("Invite someone", "Inviter quelqu'un")}</h2>
        <span className="sub" style={{ fontSize: 14 }}>
          {tr(
            `You get a link to send them (email, chat…). It opens “${ws.name}” only, works once and expires after 7 days.`,
            `Vous obtenez un lien à lui envoyer (e-mail, messagerie…). Il n'ouvre que « ${ws.name} », sert une fois et expire après 7 jours.`,
          )}
        </span>
      </div>
      <form className="inline-form" onSubmit={submit}>
        <div className="field grow">
          <label htmlFor="inv-email">{tr("Their email", "Son e-mail")}</label>
          <input id="inv-email" type="email" required autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder={tr("name@client.com", "nom@client.fr")} />
        </div>
        <div className="field">
          <label htmlFor="inv-role">{tr("Role", "Rôle")}</label>
          <select id="inv-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
        <button type="submit" className="btn primary big" disabled={sending || !f.email.trim()}>{sending ? "…" : tr("Create the link", "Créer le lien")}</button>
      </form>
      {created && (
        <CopyLink link={created.link} intro={<>{tr("Send this link to ", "Envoyez ce lien à ")}<b>{created.email}</b>{tr(". Anyone who has it can join, so send it to them only.", ". Toute personne qui l'a peut rejoindre : envoyez-le à elle seule.")}</>} />
      )}
      {invites.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="block-title">{tr("Waiting to be accepted", "En attente d'acceptation")}</span>
          <div className="list">
            {invites.map((i) => (
              <div key={i.id} className="list-row">
                <div className="grow">
                  <strong>{i.email}</strong>
                  <span className="muted">{roleLabel(i.role)} · {tr(`created ${ago(i.created_at)}`, `créée ${ago(i.created_at)}`)}</span>
                </div>
                <button type="button" className="btn small" disabled={busy !== null} onClick={() => run("x" + i.id, `/api/workspace/invites/${i.id}`, undefined, "DELETE").then(onChange)}>
                  {tr("Cancel", "Annuler")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
