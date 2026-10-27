import { useState } from "react";
import { api, type AgentDetail, type AgentSummary } from "../api.ts";
import { lang, tr } from "../i18n.ts";
import { useToast } from "./ui.tsx";
import { PRODUCT_NAME } from "../../../server/brand.ts";

type Control = AgentSummary["control"];

const TONE: Record<Control["level"], { bg: string; fg: string }> = {
  control: { bg: "#DDF7E9", fg: "#0E6B3F" },
  stop: { bg: "#EDE8FF", fg: "#4A3AA8" },
  watch: { bg: "#F1EDE7", fg: "#45424C" },
};

/** What Orvanta can really do on this agent: shown, never implied. */
export function ControlChip({ control }: { control: Control }) {
  const t = TONE[control.level];
  return (
    <span className="pill" title={control.detail} style={{ background: t.bg, color: t.fg, alignSelf: "flex-start" }}>
      {control.label}
    </span>
  );
}

const levels = (): Array<{ id: Control["level"]; title: string; text: string }> => [
  { id: "watch", title: tr("See", "Voir"), text: tr(`Its tasks, failures and incidents show up in ${PRODUCT_NAME}.`, `Ses tâches, ses échecs et ses incidents remontent dans ${PRODUCT_NAME}.`) },
  { id: "stop", title: tr("Stop", "Arrêter"), text: tr("“Pause” really stops it (for n8n: the workflow is switched off).", "« Mettre en pause » l'arrête réellement (pour n8n : le workflow est désactivé).") },
  { id: "control", title: tr("Control", "Contrôler"), text: tr("It asks for permission before its sensitive actions and waits for your go-ahead.", "Il demande la permission avant ses actions sensibles et attend votre feu vert.") },
];

const RANK: Record<Control["level"], number> = { watch: 0, stop: 1, control: 2 };

export function ControlBlock({ agent }: { agent: AgentDetail }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const rank = RANK[agent.control.level];
  // Each level includes the previous ones: an agent that asks permission can also be stopped.
  const has = (id: Control["level"]) => RANK[id] <= rank;

  const copy = async () => {
    try {
      const snippet = await api<object>(`/api/agents/${agent.id}/n8n-snippet`);
      await navigator.clipboard.writeText(JSON.stringify(snippet, null, 2));
      toast(tr("Block copied. In n8n, click in the workflow, then Ctrl+V (Cmd+V on a Mac).", "Bloc copié. Dans n8n, cliquez dans le workflow puis Ctrl+V (Cmd+V sur Mac)."));
    } catch (e) {
      toast((e as Error).message || tr("Could not copy", "Copie impossible"), true);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="block-title">{tr(`What ${PRODUCT_NAME} can do with this agent`, `Ce qu'${PRODUCT_NAME} peut faire sur cet agent`)}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {levels().map((l) => {
          const ok = has(l.id);
          return (
            <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, background: ok ? "#F3FBF6" : "#F8F6F2" }}>
              <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: ok ? "#12B76A" : "#E4DFD7", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                {ok ? "✓" : ""}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                <b>{l.title}</b> {ok ? "" : tr("— not yet", "— pas encore")}<br />
                <span style={{ color: "#5A5763" }}>{l.text}</span>
              </span>
            </div>
          );
        })}
      </div>
      {agent.source === "sdk" && rank < 2 && (
        <span className="muted" style={{ fontSize: 13 }}>
          {tr(
            `Until this agent checks with ${PRODUCT_NAME} before acting (SDK, a call to /api/v1/check, or the Zapier step “${PRODUCT_NAME} · Ask Permission”), pausing and guardrails cannot stop it.`,
            `Tant que cet agent ne consulte pas ${PRODUCT_NAME} avant d'agir (SDK, appel à /api/v1/check, ou étape Zapier « ${PRODUCT_NAME} · Ask Permission »), la pause et les garde-fous ne l'arrêtent pas.`,
          )}
        </span>
      )}
      {agent.source === "n8n" && (
        <>
          <button type="button" className="btn primary" style={{ alignSelf: "stretch", whiteSpace: "normal", lineHeight: 1.3, padding: "10px 18px" }} onClick={copy}>
            {tr("Copy the “Ask for permission” block for n8n", "Copier le bloc « Demander l'autorisation » pour n8n")}
          </button>
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start", padding: 0, background: "transparent", color: "#4A3AA8" }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? tr("Hide the instructions", "Masquer le mode d'emploi") : tr("How to install it (2 minutes)", "Comment l'installer ? (2 minutes)")}
          </button>
          {open && (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#45424C" }}>
              {lang() === "fr" ? (
                <>
                  <li>Ouvrez le workflow dans n8n et collez le bloc (Ctrl+V).</li>
                  <li>Branchez-le juste <b>avant</b> l'étape sensible (remboursement, envoi, paiement…), et branchez votre étape sur les deux sorties « oui ».</li>
                  <li>Dans « Demander l'autorisation », adaptez <i>action</i>, <i>amount_cents</i> et la phrase <i>summary</i> que vous lirez dans {PRODUCT_NAME}.</li>
                  <li>Dans votre étape sensible, reprenez les données d'origine avec <code>$('Nom du déclencheur').item.json</code>.</li>
                  <li>Enregistrez et activez : la prochaine demande au-dessus de vos seuils attendra votre feu vert.</li>
                </>
              ) : (
                <>
                  <li>Open the workflow in n8n and paste the block (Ctrl+V).</li>
                  <li>Connect it right <b>before</b> the sensitive step (refund, email, payment…), and connect your step to both “yes” outputs.</li>
                  <li>In “Ask for permission”, adjust <i>action</i>, <i>amount_cents</i> and the <i>summary</i> sentence you will read in {PRODUCT_NAME}.</li>
                  <li>In your sensitive step, use the original data with <code>$('Trigger name').item.json</code>.</li>
                  <li>Save and activate: the next request above your thresholds will wait for your go-ahead.</li>
                </>
              )}
            </ol>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            {tr(`If ${PRODUCT_NAME} cannot be reached, the workflow stops without running the action (to be safe).`, `Si ${PRODUCT_NAME} est injoignable, le workflow s'arrête sans exécuter l'action (par sécurité).`)}
          </span>
        </>
      )}
    </div>
  );
}
