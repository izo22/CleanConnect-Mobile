import { useEffect, useState, type FormEvent } from "react";
import { api, type ExchangeView } from "../api.ts";
import { ago } from "../format.ts";
import { Avatar, Icon, useAction, useToast } from "./ui.tsx";

const VERDICT = {
  ok: { label: "Correct", fg: "#0E6B3F", bg: "#DDF7E9" },
  doubt: { label: "À vérifier", fg: "#9A3412", bg: "#FFE9DF" },
  error: { label: "Erreur", fg: "#FFFFFF", bg: "#E5413A" },
} as const;

export function VerdictPill({ verdict }: { verdict: keyof typeof VERDICT }) {
  const v = VERDICT[verdict];
  return <span className="pill" style={{ background: v.bg, color: v.fg }}>{v.label}</span>;
}

export function Exchange({ input, output }: { input: string | null; output: string | null }) {
  return (
    <div className="exchange">
      <span className="lbl">Ce qu'il a reçu</span>
      <div className="bubble in">{input || "(non transmis)"}</div>
      <span className="lbl">Ce qu'il a fait ou répondu</span>
      <div className="bubble out">{output}</div>
    </div>
  );
}

/** A reviewed exchange the AI flagged; the human decides. */
export function FlaggedCard({ x }: { x: ExchangeView }) {
  const { run, busy } = useAction();
  const decide = (confirmed: boolean) => run(confirmed ? "c" : "d", `/api/reviews/${x.review_id}/verdict`, { confirmed });
  return (
    <article className="card alert-card">
      <div className="who">
        <Avatar id={x.agent_id} name={x.agent_name} />
        <div className="meta">
          <span className="name">{x.agent_name}</span>
          <span className="time">{ago(x.ts)} · relu par {x.reviewer === "démo" ? "l'IA (exemple de démo)" : "l'IA"}</span>
        </div>
        <VerdictPill verdict={x.verdict} />
      </div>
      <h3>{x.summary}</h3>
      {x.issues.length > 0 && <ul className="issues">{x.issues.map((i, k) => <li key={k}>{i.detail}</li>)}</ul>}
      <details className="more-ex"><summary>Voir l'échange</summary><Exchange input={x.input} output={x.output} /></details>
      <div className="actions" style={{ marginTop: "auto" }}>
        <button type="button" className="btn primary" disabled={busy !== null} onClick={() => decide(true)}>Oui, c'est une erreur</button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => decide(false)}>Fausse alerte</button>
      </div>
    </article>
  );
}

/** "Signaler une erreur": anyone in the team can flag something an agent did. */
export function ReportModal({ agentId, agentName, eventId, excerpt, onClose }: { agentId: string; agentName: string; eventId?: number; excerpt?: string | null; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api<{ message: string }>(`/api/agents/${agentId}/reports`, { method: "POST", body: { description: text.trim(), ...(eventId ? { event_id: eventId } : {}) } });
      toast(res.message);
      onClose();
    } catch (err) {
      toast((err as Error).message, true);
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="report-h" onSubmit={submit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 id="report-h" className="h2">Signaler une erreur</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" size={16} /></button>
        </div>
        <p className="sub">Agent : <strong>{agentName}</strong>. Le responsable sera prévenu et l'erreur apparaîtra dans les alertes.</p>
        {excerpt && <div className="exchange"><span className="lbl">Échange concerné</span><div className="bubble out">{excerpt}</div></div>}
        <div className="field">
          <label htmlFor="what">Qu'est-ce qui ne va pas ?</label>
          <textarea id="what" required minLength={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus
            placeholder="Ex. : il a promis un remboursement sous 60 jours, c'est 30 chez nous." />
        </div>
        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn big" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary big" disabled={saving || text.trim().length < 3}>{saving ? "Envoi…" : "Signaler"}</button>
        </div>
      </form>
    </div>
  );
}
