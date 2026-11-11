import { useState, type ReactNode } from "react";
import { api, useData } from "../api.ts";
import { useCan } from "../account.tsx";
import { ago } from "../format.ts";
import { tr } from "../i18n.ts";
import { ErrorBox, Skeleton, useToast } from "./ui.tsx";
import { PRODUCT_NAME } from "../../../server/brand.ts";

export interface ZapierLinks { invite_url?: string; monitor_url?: string; pause_url?: string; permission_url?: string }
interface ZapierView {
  key: string | null;
  links: ZapierLinks;
  zaps: Array<{ id: string; name: string; last_check_at: number | null; last_event: number | null }>;
}

export function CopyValue({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const toast = useToast();
  const [shown, setShown] = useState(!secret);
  const copy = () =>
    navigator.clipboard?.writeText(value).then(
      () => toast(tr(`${label} copied.`, `${label} copiée.`)),
      () => toast(tr("Copy failed: select it and copy it by hand.", "Copie impossible : sélectionnez-la et copiez-la à la main."), true),
    );
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input readOnly aria-label={label} value={shown ? value : "•".repeat(28)} style={{ flex: "1 1 220px", fontFamily: shown ? "ui-monospace, monospace" : undefined }}
          onFocus={(e) => shown && e.currentTarget.select()} />
        {secret && <button type="button" className="btn" onClick={() => setShown((s) => !s)}>{shown ? tr("Hide", "Masquer") : tr("Show", "Afficher")}</button>}
        <button type="button" className="btn primary" onClick={copy}>{tr("Copy", "Copier")}</button>
      </div>
    </div>
  );
}

/** One numbered step of the Zapier set-up. */
export function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: done ? "#12B76A" : "var(--accent-soft)", color: done ? "#fff" : "var(--accent-text)" }}>
        {done ? "✓" : n}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{title}</strong>
        {children}
      </div>
    </div>
  );
}

export const Text = ({ children }: { children: ReactNode }) => <span style={{ fontSize: 14, lineHeight: 1.55, color: "#45424C" }}>{children}</span>;

/** A ready-to-copy Zap shared by the administrator, or how to build it by hand when there is none yet. */
function ZapLink({ url, label, recipe }: { url?: string; label: string; recipe: ReactNode }) {
  return url ? (
    <a className="btn primary" style={{ alignSelf: "flex-start", textDecoration: "none" }} href={url} target="_blank" rel="noreferrer">{label}</a>
  ) : (
    <details className="more-ex">
      <summary>{tr("How to build it in Zapier (3 minutes)", "Comment le créer dans Zapier (3 minutes)")}</summary>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: "#45424C" }}>{recipe}</div>
    </details>
  );
}

/** Connections → Zapier: everything a business owner does once, in order. */
export function ZapierSetup() {
  const { data, error, reload } = useData<ZapierView>("/api/zapier");
  const owner = useCan()("owner");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const makeKey = async () => {
    if (data?.key && !window.confirm(tr("Create a new key? Zaps connected with the current one will stop working until you update their connection in Zapier.", "Créer une nouvelle clé ? Les Zaps branchés avec l'actuelle ne marcheront plus tant que vous n'aurez pas mis à jour leur connexion dans Zapier."))) return;
    setBusy(true);
    try {
      const res = await api<{ message: string }>("/api/zapier/key", { method: "POST", body: {} });
      toast(res.message);
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="zapier-h" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar" style={{ width: 46, height: 46, background: "#FFE9DF", color: "#9A3412", fontSize: 12 }}>Zap</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 id="zapier-h" className="h2" style={{ fontSize: 22 }}>Zapier</h2>
          <span className="muted" style={{ fontSize: 13 }}>
            {tr(`One key for all your Zaps. Each Zap becomes an agent in ${PRODUCT_NAME}, like n8n workflows.`, `Une seule clé pour tous vos Zaps. Chaque Zap devient un agent dans ${PRODUCT_NAME}, comme les workflows n8n.`)}
          </span>
        </div>
      </div>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={1} />}
      {data && (
        <>
          <Step n={1} title={tr(`Add the ${PRODUCT_NAME} app to your Zapier`, `Ajouter l'application ${PRODUCT_NAME} à votre Zapier`)}>
            {data.links.invite_url ? (
              <>
                <Text>{tr("Open the invitation while signed in to Zapier, then accept it. Once is enough for the whole team.", "Ouvrez l'invitation en étant connecté à Zapier, puis acceptez-la. Une fois suffit pour toute l'équipe.")}</Text>
                <a className="btn primary" style={{ alignSelf: "flex-start", textDecoration: "none" }} href={data.links.invite_url} target="_blank" rel="noreferrer">{tr("Open the invitation", "Ouvrir l'invitation")}</a>
              </>
            ) : (
              <Text>{tr(`Ask your ${PRODUCT_NAME} administrator for the invitation link to the app.`, `Demandez à votre administrateur ${PRODUCT_NAME} le lien d'invitation à l'application.`)}</Text>
            )}
          </Step>

          <Step n={2} title={tr("Connect it with your Zapier key", "La connecter avec votre clé Zapier")} done={!!data.key}>
            <Text>
              {tr(
                `The first time you add an ${PRODUCT_NAME} step in a Zap, Zapier asks for these two things. Then, in each step, the “Agent” field says which agent the Zap is: pick it, or type the Zap's name and ${PRODUCT_NAME} creates it.`,
                `La première fois que vous ajoutez une étape ${PRODUCT_NAME} dans un Zap, Zapier demande ces deux informations. Ensuite, dans chaque étape, le champ « Agent » dit quel agent est ce Zap : choisissez-le, ou tapez le nom du Zap et ${PRODUCT_NAME} le crée.`,
              )}
            </Text>
            <CopyValue label={tr(`${PRODUCT_NAME} Address`, `Adresse ${PRODUCT_NAME}`)} value={origin} />
            {data.key ? (
              <CopyValue label={tr("Connection Key", "Clé de connexion")} value={data.key} secret />
            ) : owner ? null : (
              <Text>{tr("The workspace owner creates the key here.", "C'est le propriétaire de l'espace qui crée la clé ici.")}</Text>
            )}
            {owner && (
              <button type="button" className={data.key ? "link-btn" : "btn primary"} disabled={busy} onClick={makeKey}
                style={data.key ? { alignSelf: "flex-start", padding: 0, background: "transparent", color: "#4A3AA8" } : { alignSelf: "flex-start" }}>
                {data.key ? tr("Create a new key (if this one leaked)", "Créer une nouvelle clé (si celle-ci a fuité)") : tr("Create my Zapier key", "Créer ma clé Zapier")}
              </button>
            )}
          </Step>

          <Step n={3} title={tr("Watch all your Zaps (once)", "Surveiller tous vos Zaps (une seule fois)")}>
            <Text>{tr(`As soon as any Zap fails, the alert arrives in ${PRODUCT_NAME}, even for Zaps with no ${PRODUCT_NAME} step.`, `Dès qu'un Zap plante, l'alerte arrive dans ${PRODUCT_NAME}, même pour les Zaps sans aucune étape ${PRODUCT_NAME}.`)}</Text>
            <ZapLink url={data.links.monitor_url} label={tr("Copy this Zap into my Zapier", "Copier ce Zap dans mon Zapier")} recipe={
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>{tr("Trigger: ", "Déclencheur : ")}<b>Zapier Manager → New Zap Error</b>.</li>
                <li>{tr("Action: ", "Action : ")}<b>{PRODUCT_NAME} → Report a Zap Error</b>.</li>
                <li>{tr("Agent: map the Zap's name. Error Message: map the error message.", "Agent : mettez le nom du Zap. Error Message : mettez le message d'erreur.")}</li>
                <li>{tr("Publish.", "Publiez.")}</li>
              </ol>
            } />
          </Step>

          <Step n={4} title={tr("Emergency stop (once)", "Arrêt d'urgence (une seule fois)")}>
            <Text>{tr(`When you pause an agent in ${PRODUCT_NAME}, its Zap is switched off. Even without this, a paused agent's “Ask Permission” steps are refused.`, `Quand vous mettez un agent en pause dans ${PRODUCT_NAME}, son Zap est éteint. Même sans cela, les étapes « Ask Permission » d'un agent en pause sont refusées.`)}</Text>
            <ZapLink url={data.links.pause_url} label={tr("Copy this Zap into my Zapier", "Copier ce Zap dans mon Zapier")} recipe={
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>{tr("Trigger: ", "Déclencheur : ")}<b>{PRODUCT_NAME} → Agent Paused or Resumed</b>{tr(", Agent left empty (all agents).", ", Agent laissé vide (tous les agents).")}</li>
                <li>{tr("Action: ", "Action : ")}<b>Zapier Manager</b>{tr(", the action that turns a Zap off. Zap: map “Zap ID” (or the agent's name).", ", l'action qui éteint un Zap. Zap : mettez « Zap ID » (ou le nom de l'agent).")}</li>
                <li>{tr("Publish.", "Publiez.")}</li>
              </ol>
            } />
          </Step>

          <Step n={5} title={tr("Ask me before a step, in a Zap", "Me demander avant une étape, dans un Zap")}>
            <Text>
              {tr(
                `In the Zap, add the “${PRODUCT_NAME} → Ask Permission” step right before the sensitive action (sending, paying…). The Zap waits for your click in Decisions, then goes on by itself. Declined: it stops.`,
                `Dans le Zap, ajoutez l'étape « ${PRODUCT_NAME} → Ask Permission » juste avant l'action sensible (envoi, paiement…). Le Zap attend votre clic dans Décisions, puis continue tout seul. Refusé : il s'arrête.`,
              )}
            </Text>
            {data.links.permission_url && (
              <a className="btn" style={{ alignSelf: "flex-start", textDecoration: "none" }} href={data.links.permission_url} target="_blank" rel="noreferrer">{tr("See a ready-to-copy example", "Voir un exemple prêt à copier")}</a>
            )}
          </Step>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <span className="block-title">{tr(`Zaps followed (${data.zaps.length})`, `Zaps suivis (${data.zaps.length})`)}</span>
            {data.zaps.length === 0 ? (
              <span className="muted" style={{ fontSize: 13 }}>{tr(`None yet: they appear here the first time a Zap talks to ${PRODUCT_NAME}.`, `Aucun pour l'instant : ils apparaissent ici la première fois qu'un Zap parle à ${PRODUCT_NAME}.`)}</span>
            ) : (
              <div className="list">
                {data.zaps.map((z) => (
                  <a key={z.id} className="list-row" href={`#/team/${encodeURIComponent(z.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <div className="grow">
                      <strong>{z.name}</strong>
                      <span className="muted">
                        {z.last_event ? tr(`Last activity ${ago(z.last_event)}`, `Dernière activité ${ago(z.last_event)}`) : tr("No activity reported yet", "Pas encore d'activité")}
                        {" · "}
                        {z.last_check_at ? tr("asks permission", "demande la permission") : tr("never asks permission", "ne demande jamais la permission")}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** On a Zapier agent's page: how to make this Zap ask before acting. */
export function ZapierAgentBlock() {
  const { data } = useData<ZapierView>("/api/zapier");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 16, border: "2px solid var(--line)" }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{tr("Ask me before a step", "Me demander avant une étape")}</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: "#45424C" }}>
        {tr(
          `Zapier doesn't let ${PRODUCT_NAME} change a Zap by itself: the step is added once, in Zapier.`,
          `Zapier ne laisse pas ${PRODUCT_NAME} modifier un Zap tout seul : l'étape s'ajoute une fois, dans Zapier.`,
        )}
      </span>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#45424C" }}>
        <li>{tr("Open the Zap in Zapier and click + right before the sensitive step (sending, paying…).", "Ouvrez le Zap dans Zapier et cliquez sur + juste avant l'étape sensible (envoi, paiement…).")}</li>
        <li>{tr(`Choose ${PRODUCT_NAME} → Ask Permission, and this agent in “Agent”.`, `Choisissez ${PRODUCT_NAME} → Ask Permission, et cet agent dans « Agent ».`)}</li>
        <li>{tr("Write the sentence you will read in Decisions (Summary) and, for thresholds, the amount.", "Écrivez la phrase que vous lirez dans Décisions (Summary) et, pour les seuils, le montant.")}</li>
        <li>{tr("Leave “Wait for the decision, then go on”, then publish.", "Laissez « Wait for the decision, then go on », puis publiez.")}</li>
      </ol>
      <span style={{ fontSize: 13, color: "#0E6B3F" }}>
        {tr("Then the Zap waits for your click in Decisions before that step, and goes on by itself.", "Ensuite, le Zap attend votre clic dans Décisions avant cette étape, et continue tout seul.")}
      </span>
      {data?.links.permission_url && (
        <a className="btn" style={{ alignSelf: "flex-start", textDecoration: "none" }} href={data.links.permission_url} target="_blank" rel="noreferrer">{tr("See a ready-to-copy example", "Voir un exemple prêt à copier")}</a>
      )}
    </div>
  );
}

/** Administration: the links every client sees on Connections → Zapier. */
export function ZapierLinksAdmin() {
  const { data, error, reload } = useData<ZapierLinks>("/api/admin/zapier-links");
  const toast = useToast();
  const [form, setForm] = useState<ZapierLinks | null>(null);
  const [busy, setBusy] = useState(false);
  const f = form ?? data ?? {};
  const fields: Array<{ key: keyof ZapierLinks; label: string; hint: string }> = [
    { key: "invite_url", label: tr("Invitation to the Zapier app", "Invitation à l'application Zapier"), hint: tr("Zapier developer platform → your app → Manage → Sharing, or `zapier-platform users:links`.", "Plateforme développeur Zapier → votre application → Manage → Sharing, ou `zapier-platform users:links`.") },
    { key: "monitor_url", label: tr("Zap “Watch all my Zaps”", "Zap « Surveiller tous mes Zaps »"), hint: tr("In Zapier: the Zap → ⋯ → Share → copy the link.", "Dans Zapier : le Zap → ⋯ → Share → copiez le lien.") },
    { key: "pause_url", label: tr("Zap “Emergency stop”", "Zap « Arrêt d'urgence »"), hint: tr("Same, for the emergency-stop Zap.", "Pareil, pour le Zap d'arrêt d'urgence.") },
    { key: "permission_url", label: tr("Example Zap with “Ask Permission”", "Zap d'exemple avec « Ask Permission »"), hint: tr("Optional: a model Zap that asks before sending.", "Facultatif : un Zap modèle qui demande avant d'envoyer.") },
  ];
  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ message: string }>("/api/admin/zapier-links", { method: "PUT", body: f });
      toast(res.message);
      reload();
      setForm(null);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" aria-labelledby="zlinks-h" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 id="zlinks-h" className="h2" style={{ fontSize: 22 }}>{tr("Zapier links (for all your clients)", "Liens Zapier (pour tous vos clients)")}</h2>
        <span className="sub" style={{ fontSize: 14 }}>{tr("Shown on every workspace's Connections → Zapier. Leave empty what you don't have yet: clients then see how to do it by hand.", "Affichés dans Connexions → Zapier de chaque espace. Laissez vide ce que vous n'avez pas encore : les clients voient alors comment faire à la main.")}</span>
      </div>
      {error && <ErrorBox message={error.message} />}
      {fields.map((x) => (
        <div key={x.key} className="field">
          <label htmlFor={`zl-${x.key}`}>{x.label}</label>
          <input id={`zl-${x.key}`} type="url" placeholder="https://zapier.com/…" value={f[x.key] ?? ""} onChange={(e) => setForm({ ...f, [x.key]: e.target.value })} />
          <span className="hint">{x.hint}</span>
        </div>
      ))}
      <button type="button" className="btn primary big" style={{ alignSelf: "flex-start" }} disabled={busy || !form} onClick={save}>{tr("Save", "Enregistrer")}</button>
    </section>
  );
}
