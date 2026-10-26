import { useState } from "react";
import { api, type AgentDetail, type AgentSummary } from "../api.ts";
import { useToast } from "./ui.tsx";

type Control = AgentSummary["control"];

const TONE: Record<Control["level"], { bg: string; fg: string }> = {
  control: { bg: "#DDF7E9", fg: "#0E6B3F" },
  stop: { bg: "#EDE8FF", fg: "#4A3AA8" },
  watch: { bg: "#F1EDE7", fg: "#45424C" },
};

/** What Agent HQ can really do on this agent: shown, never implied. */
export function ControlChip({ control }: { control: Control }) {
  const t = TONE[control.level];
  return (
    <span className="pill" title={control.detail} style={{ background: t.bg, color: t.fg, alignSelf: "flex-start" }}>
      {control.label}
    </span>
  );
}

const LEVELS: Array<{ id: Control["level"]; title: string; text: string }> = [
  { id: "watch", title: "Voir", text: "Ses tâches, ses échecs et ses incidents remontent dans Agent HQ." },
  { id: "stop", title: "Arrêter", text: "« Mettre en pause » l'arrête réellement (pour n8n : le workflow est désactivé)." },
  { id: "control", title: "Contrôler", text: "Il demande la permission avant ses actions sensibles et attend votre feu vert." },
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
      toast("Bloc copié. Dans n8n, cliquez dans le workflow puis Ctrl+V (Cmd+V sur Mac).");
    } catch (e) {
      toast((e as Error).message || "Copie impossible", true);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="block-title">Ce qu'Agent HQ peut faire sur cet agent</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {LEVELS.map((l) => {
          const ok = has(l.id);
          return (
            <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, background: ok ? "#F3FBF6" : "#F8F6F2" }}>
              <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: ok ? "#12B76A" : "#E4DFD7", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                {ok ? "✓" : ""}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                <b>{l.title}</b> {ok ? "" : "— pas encore"}<br />
                <span style={{ color: "#5A5763" }}>{l.text}</span>
              </span>
            </div>
          );
        })}
      </div>
      {agent.source === "sdk" && rank < 2 && (
        <span className="muted" style={{ fontSize: 13 }}>
          Tant que cet agent ne consulte pas Agent HQ avant d'agir (SDK ou appel à /api/v1/check), la pause et les garde-fous ne l'arrêtent pas.
        </span>
      )}
      {agent.source === "n8n" && (
        <>
          <button type="button" className="btn primary" style={{ alignSelf: "stretch", whiteSpace: "normal", lineHeight: 1.3, padding: "10px 18px" }} onClick={copy}>
            Copier le bloc « Demander l'autorisation » pour n8n
          </button>
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start", padding: 0, background: "transparent", color: "#4A3AA8" }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Masquer le mode d'emploi" : "Comment l'installer ? (2 minutes)"}
          </button>
          {open && (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#45424C" }}>
              <li>Ouvrez le workflow dans n8n et collez le bloc (Ctrl+V).</li>
              <li>Branchez-le juste <b>avant</b> l'étape sensible (remboursement, envoi, paiement…), et branchez votre étape sur les deux sorties « oui ».</li>
              <li>Dans « Demander l'autorisation », adaptez <i>action</i>, <i>amount_cents</i> et la phrase <i>summary</i> que vous lirez dans Agent HQ.</li>
              <li>Dans votre étape sensible, reprenez les données d'origine avec <code>$('Nom du déclencheur').item.json</code>.</li>
              <li>Enregistrez et activez : la prochaine demande au-dessus de vos seuils attendra votre feu vert.</li>
            </ol>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            Si Agent HQ est injoignable, le workflow s'arrête sans exécuter l'action (par sécurité).
          </span>
        </>
      )}
    </div>
  );
}
