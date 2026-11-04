import { useState } from "react";
import { api, session, useData } from "../api.ts";
import { shortTime } from "../format.ts";
import { tr } from "../i18n.ts";

interface AuditCheck {
  ok: boolean;
  entries: number;
  last_hash: string | null;
  broken_at?: number;
  problem?: "changed" | "missing" | "reordered";
  checked_at: number;
}

/** The tamper-evident record: is the history intact, its fingerprint, and a copy to keep. */
export function AuditRecord() {
  const { data, reload } = useData<{ check: AuditCheck }>("/api/audit?limit=1");
  const [busy, setBusy] = useState(false);
  const c = data?.check;

  const download = async () => {
    setBusy(true);
    try {
      const body = await api<unknown>("/api/audit/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `orvanta-record-${session.workspace || "workspace"}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const problem = (p?: AuditCheck["problem"]) =>
    p === "missing" ? tr("was removed", "a été supprimée") : tr("was changed after the fact", "a été modifiée après coup");

  return (
    <div className="card audit-card">
      <div className="audit-head">
        <div>
          <h2 className="h2">{tr("Tamper-evident record", "Registre infalsifiable")}</h2>
          <p className="muted">
            {tr(
              "Every decision and every change is chained to the one before. If anyone edits or deletes a past entry, the check below shows it.",
              "Chaque décision et chaque modification est reliée à la précédente. Si quelqu'un modifie ou supprime une ancienne entrée, la vérification ci-dessous le montre.",
            )}
          </p>
        </div>
        <div className="audit-actions">
          <button type="button" className="btn small" onClick={reload}>{tr("Check again", "Vérifier à nouveau")}</button>
          <button type="button" className="btn small dark" onClick={download} disabled={busy || !c?.entries}>
            {busy ? "…" : tr("Download the record", "Télécharger le registre")}
          </button>
        </div>
      </div>
      {c && (
        c.ok ? (
          <div className="audit-status ok">
            <span className="pill"><span className="dot" />{tr("Intact", "Intact")}</span>
            <span>
              {c.entries === 0
                ? tr("Nothing recorded yet.", "Rien d'enregistré pour l'instant.")
                : tr(`${c.entries.toLocaleString("en-US")} entries, nothing has been changed.`, `${c.entries.toLocaleString("fr-FR")} entrées, rien n'a été modifié.`)}
            </span>
            {c.last_hash && (
              <span className="muted" title={c.last_hash}>
                {tr("Fingerprint", "Empreinte")} <code>{c.last_hash.slice(0, 8)}…{c.last_hash.slice(-6)}</code> · {tr("checked", "vérifié")} {shortTime(c.checked_at)}
              </span>
            )}
          </div>
        ) : (
          <div className="audit-status bad">
            <span className="pill"><span className="dot" />{tr("Altered", "Altéré")}</span>
            <span>
              {tr(`Entry #${c.broken_at} ${problem(c.problem)}.`, `L'entrée n°${c.broken_at} ${problem(c.problem)}.`)}{" "}
              {tr("Everything recorded before it is intact.", "Tout ce qui a été enregistré avant elle est intact.")}
            </span>
          </div>
        )
      )}
    </div>
  );
}
