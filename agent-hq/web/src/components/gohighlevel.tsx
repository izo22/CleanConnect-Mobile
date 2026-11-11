import { useState } from "react";
import { api, useData } from "../api.ts";
import { useCan } from "../account.tsx";
import { ago } from "../format.ts";
import { tr } from "../i18n.ts";
import { ErrorBox, Skeleton, useToast } from "./ui.tsx";
import { CopyValue, Step, Text } from "./zapier.tsx";
import { PRODUCT_NAME } from "../../../server/brand.ts";

interface GhlView {
  key: string | null;
  workflows: Array<{ id: string; name: string; paused: number; last_check_at: number | null; last_event: number | null }>;
}

const Code = ({ children }: { children: string }) => <code style={{ wordBreak: "break-all" }}>{children}</code>;

/** Connections → GoHighLevel: plain "Webhook" actions, the key in the address. */
export function GhlSetup() {
  const { data, error, reload } = useData<GhlView>("/api/gohighlevel");
  const owner = useCan()("owner");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const activity = data?.key ? `${origin}/api/v1/ghl/${data.key}/activity` : "";
  const check = data?.key ? `${origin}/api/v1/ghl/${data.key}/check` : "";

  const makeKey = async () => {
    if (data?.key && !window.confirm(tr("Create new addresses? Webhooks using the current ones will stop working until you paste the new ones in GoHighLevel.", "Créer de nouvelles adresses ? Les webhooks qui utilisent les actuelles ne marcheront plus tant que vous n'aurez pas collé les nouvelles dans GoHighLevel."))) return;
    setBusy(true);
    try {
      await api("/api/gohighlevel/key", { method: "POST", body: {} });
      toast(tr("GoHighLevel addresses ready.", "Adresses GoHighLevel prêtes."));
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="ghl-h" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar" style={{ width: 46, height: 46, background: "#DDF0FF", color: "#0B4A8B", fontSize: 12 }}>GHL</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 id="ghl-h" className="h2" style={{ fontSize: 22 }}>GoHighLevel</h2>
          <span className="muted" style={{ fontSize: 13 }}>
            {tr(
              `Every workflow of every sub-account in one place. Each workflow becomes an agent in ${PRODUCT_NAME}, named after the sub-account.`,
              `Tous les workflows de tous vos sous-comptes au même endroit. Chaque workflow devient un agent dans ${PRODUCT_NAME}, au nom du sous-compte.`,
            )}
          </span>
        </div>
      </div>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={1} />}
      {data && (
        <>
          <Step n={1} title={tr("Get your two addresses", "Obtenir vos deux adresses")} done={!!data.key}>
            {data.key ? (
              <>
                <Text>{tr("Keep them private: anyone with them can report activity in your workspace.", "Gardez-les privées : quiconque les a peut envoyer de l'activité dans votre espace.")}</Text>
                <CopyValue label={tr("Activity address", "Adresse d'activité")} value={activity} secret />
                <CopyValue label={tr("Ask-permission address", "Adresse de demande de permission")} value={check} secret />
              </>
            ) : !owner ? (
              <Text>{tr("The workspace owner creates them here.", "C'est le propriétaire de l'espace qui les crée ici.")}</Text>
            ) : null}
            {owner && (
              <button type="button" className={data.key ? "link-btn" : "btn primary"} disabled={busy} onClick={makeKey}
                style={data.key ? { alignSelf: "flex-start", padding: 0, background: "transparent", color: "#4A3AA8" } : { alignSelf: "flex-start" }}>
                {data.key ? tr("Create new addresses (if these leaked)", "Créer de nouvelles adresses (si celles-ci ont fuité)") : tr("Create my GoHighLevel addresses", "Créer mes adresses GoHighLevel")}
              </button>
            )}
          </Step>

          <Step n={2} title={tr("See what each workflow does", "Voir ce que fait chaque workflow")}>
            <Text>{tr("In a GoHighLevel workflow, add the action ", "Dans un workflow GoHighLevel, ajoutez l'action ")}<b>Webhook</b>{tr(" after the important step, and paste the activity address followed by what the step did:", " après l'étape importante, et collez l'adresse d'activité suivie de ce que l'étape a fait :")}</Text>
            <Code>{`${tr("<activity address>", "<adresse d'activité>")}?action=sms.send`}</Code>
            <Text>{tr("On a failure branch, add ", "Sur une branche d'échec, ajoutez ")}<Code>{"&status=failure&error=No reply from the CRM"}</Code>{tr(`: ${PRODUCT_NAME} alerts you when failures pile up.`, ` : ${PRODUCT_NAME} vous alerte quand les échecs s'accumulent.`)}</Text>
          </Step>

          <Step n={3} title={tr("Ask me before a sensitive step", "Me demander avant une étape sensible")}>
            <Text>{tr("Split the workflow in two:", "Coupez le workflow en deux :")}</Text>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#45424C" }}>
              <li>
                {tr("Create a second workflow with the trigger ", "Créez un second workflow avec le déclencheur ")}<b>Inbound Webhook</b>
                {tr(" and copy its URL. Put the sensitive step there (send the quote, the SMS…), after an ", " et copiez son URL. Mettez-y l'étape sensible (envoyer le devis, le SMS…), après une condition ")}
                <b>If/Else</b>{tr(" on ", " sur ")}<Code>approved</Code>{tr(" = true. It receives the contact (contact_id, email, phone, first_name) and the decision.", " = true. Il reçoit le contact (contact_id, email, phone, first_name) et la décision.")}
              </li>
              <li>
                {tr("In the first workflow, where the sensitive step was, add the action ", "Dans le premier workflow, à la place de l'étape sensible, ajoutez l'action ")}<b>Webhook</b>
                {tr(" with the ask-permission address, and in Custom data:", " avec l'adresse de demande de permission, et dans Custom data :")}
                <span style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  <span><Code>action</Code> · <Code>quote.send</Code></span>
                  <span><Code>summary</Code> · <Code>{"Send the quote to {{contact.name}}"}</Code></span>
                  <span><Code>amount</Code> · {tr("the amount, for rules like “Over $5,000, I approve”", "le montant, pour les règles du type « Au-dessus de 5 000 $, je valide »")}</span>
                  <span><Code>continue_url</Code> · {tr("the Inbound Webhook URL of the second workflow", "l'URL Inbound Webhook du second workflow")}</span>
                </span>
              </li>
            </ol>
            <Text>{tr(`Allowed by your rules: the second workflow starts right away. Otherwise it waits for your click in Decisions. Declined, or the agent is paused: it receives approved = false.`, `Autorisé par vos règles : le second workflow démarre tout de suite. Sinon, il attend votre clic dans Décisions. Refusé, ou agent en pause : il reçoit approved = false.`)}</Text>
          </Step>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <span className="block-title">{tr(`Workflows followed (${data.workflows.length})`, `Workflows suivis (${data.workflows.length})`)}</span>
            {data.workflows.length === 0 ? (
              <span className="muted" style={{ fontSize: 13 }}>{tr(`None yet: they appear here the first time a workflow calls ${PRODUCT_NAME}.`, `Aucun pour l'instant : ils apparaissent ici la première fois qu'un workflow appelle ${PRODUCT_NAME}.`)}</span>
            ) : (
              <div className="list">
                {data.workflows.map((w) => (
                  <a key={w.id} className="list-row" href={`#/team/${encodeURIComponent(w.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <div className="grow">
                      <strong>{w.name}{w.paused ? tr(" · paused", " · en pause") : ""}</strong>
                      <span className="muted">
                        {w.last_event ? tr(`Last activity ${ago(w.last_event)}`, `Dernière activité ${ago(w.last_event)}`) : tr("No activity reported yet", "Pas encore d'activité")}
                        {" · "}
                        {w.last_check_at ? tr("asks permission", "demande la permission") : tr("never asks permission", "ne demande jamais la permission")}
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
