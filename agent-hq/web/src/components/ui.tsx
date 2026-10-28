import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { api, type AlertView, type ApprovalView } from "../api.ts";
import { ago, avatarColors, initials } from "../format.ts";
import { tr } from "../i18n.ts";
import { useCan } from "../account.tsx";

// ---------- Icons (stroke, currentColor) ----------

const paths = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14.5c2.4.2 4 1.9 4.5 4.5" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 21h4" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  shield: <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  journal: <><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13l2.5 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  plug: <><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0V8z" /><path d="M12 17v4" /></>,
  members: <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M19 8v6M16 11h6" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
};

export function Icon({ name, size = 19, stroke = 2 }: { name: keyof typeof paths; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="11" fill="#1B1A1F" />
      <circle cx="12" cy="13" r="3" fill="#fff" />
      <circle cx="22" cy="13" r="3" fill="#fff" />
      <circle cx="12" cy="22" r="3" fill="#fff" />
      <circle cx="22" cy="22" r="3" fill="#FF7A59" />
    </svg>
  );
}

// ---------- Small pieces ----------

export function Avatar({ id, name, size = 42 }: { id: string; name: string; size?: number }) {
  const [bg, fg] = avatarColors(id);
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.33, borderRadius: size * 0.33 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// Labels are getters: the language is only known once the app has started.
export const STATUS = {
  ok: { get label() { return tr("Healthy", "En forme"); }, fg: "#0E6B3F", bg: "#DDF7E9", dot: "#12B76A" },
  attention: { get label() { return tr("Needs a look", "À surveiller"); }, fg: "#9A3412", bg: "#FFE9DF", dot: "#FF7A45" },
  blocked: { get label() { return tr("Blocked", "Bloqué"); }, fg: "#4A3AA8", bg: "#EDE8FF", dot: "#7C5CFF" },
  paused: { get label() { return tr("Paused", "En pause"); }, fg: "#45424C", bg: "#F1EDE7", dot: "#9C97A3" },
  waiting: { get label() { return tr("Waiting for data", "En attente de données"); }, fg: "#2F4A8A", bg: "#E7EEFF", dot: "#6B8DE3" },
} as const;

export function StatusPill({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return (
    <span className="pill" style={{ background: s.bg, color: s.fg }}>
      <span className="dot" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

const SEVERITY = {
  critical: { get label() { return tr("Urgent", "Urgent"); }, fg: "#FFFFFF", bg: "#E5413A" },
  blocked: { get label() { return tr("Blocked", "Bloqué"); }, fg: "#4A3AA8", bg: "#EDE8FF" },
  warning: { get label() { return tr("Needs a look", "À surveiller"); }, fg: "#9A3412", bg: "#FFE9DF" },
} as const;

export function SeverityPill({ severity }: { severity: keyof typeof SEVERITY }) {
  const s = SEVERITY[severity];
  return <span className="pill" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

export function Trust({ level }: { level: number }) {
  return (
    <span className="trust" title={tr(`Trust level ${level} of 2`, `Niveau de confiance ${level} sur 2`)}>
      {tr("Trust", "Confiance")} <i className={level >= 0 ? "on" : ""} /><i className={level >= 1 ? "on" : ""} /><i className={level >= 2 ? "on" : ""} />
    </span>
  );
}

export function Sparkline({ values, width = 120, height = 28, color = "#5B3DF5" }: { values: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg className="spark" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={tr("Activity over the last 24 hours", "Activité des dernières 24 heures")}>
      <polyline points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={color} opacity="0.1" stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Ring({ value, total, label }: { value: number; total: number; label: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = total ? (c * value) / total : 0;
  return (
    <div className="ring">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={tr(`${value} of ${total} agents ${label}`, `${value} agents sur ${total} ${label}`)}>
        <circle cx="66" cy="66" r={r} fill="none" stroke="#34323A" strokeWidth="14" />
        <circle className="val" cx="66" cy="66" r={r} fill="none" stroke="#2BD483" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} transform="rotate(-90 66 66)" />
      </svg>
      <div className="center"><span className="num">{value}</span><span className="lbl">{label}</span></div>
    </div>
  );
}

export function Skeleton({ count = 3 }: { count?: number }) {
  return <div className="grid-cards">{Array.from({ length: count }, (_, i) => <div key={i} className="skeleton" />)}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box" role="alert">{message}</div>;
}

// ---------- Toasts and actions ----------

interface Toast { id: number; message: string; error?: boolean }
const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, error?: boolean) => {
    const id = Date.now();
    setToast({ id, message, error });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toast && (
          <div className={"toast" + (toast.error ? " error" : "")} role="status">
            {!toast.error && <span className="ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B3B24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>}
            <span className="msg">{toast.message}</span>
            <button type="button" onClick={() => setToast(null)}>OK</button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Runs an API mutation, shows the server's message (or error) as a toast. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async (key: string, path: string, body?: unknown, method = "POST") => {
      setBusy(key);
      try {
        const res = await api<{ message?: string }>(path, { method, body: body ?? {} });
        if (res?.message) toast(res.message);
        return res;
      } catch (e) {
        toast((e as Error).message, true);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );
  return { run, busy };
}

// ---------- Shared cards ----------

export function AlertCard({ alert, wide = false }: { alert: AlertView; wide?: boolean }) {
  const { run, busy } = useAction();
  const operate = useCan()("member");
  const who = (
    <div className="who">
      <Avatar id={alert.agent_id} name={alert.agent?.name ?? "?"} />
      <div className="meta">
        <span className="name">{alert.agent?.name}</span>
        <span className="time">{ago(alert.created_at)}</span>
      </div>
      <SeverityPill severity={alert.severity} />
    </div>
  );
  const explain = (
    <div className="explain">
      <span><strong>{tr("Why:", "Pourquoi :")}</strong> {alert.cause}</span>
      <span><strong>{tr("Impact:", "Impact :")}</strong> {alert.impact}</span>
    </div>
  );
  const buttons = !operate ? null : alert.actions.map((a, i) => (
    <button key={a.id} type="button" className={"btn" + (i === 0 ? " primary" : "")} disabled={busy !== null} onClick={() => run(a.id, `/api/alerts/${alert.id}/actions/${a.id}`)}>
      {busy === a.id ? "…" : a.label}
    </button>
  ));
  if (wide) {
    return (
      <article className="card alert-wide">
        <div className="body">
          {who}
          <h3 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.35 }}>{alert.title}</h3>
          {explain}
          {alert.resolution && <span className="note">{alert.resolution}</span>}
        </div>
        <div className="side">{buttons}</div>
      </article>
    );
  }
  return (
    <article className="card alert-card">
      {who}
      <h3>{alert.title}</h3>
      {explain}
      {alert.resolution && <span className="note">{alert.resolution}</span>}
      <div className="actions" style={{ marginTop: "auto" }}>{buttons}</div>
    </article>
  );
}

export function DecisionButtons({ approval, big = false }: { approval: ApprovalView; big?: boolean }) {
  const { run, busy } = useAction();
  const decide = (approve: boolean) => run(approve ? "y" : "n", `/api/approvals/${approval.id}/decision`, { approve });
  return (
    <>
      <button type="button" className={"btn" + (big ? " big" : "")} disabled={busy !== null} onClick={() => decide(false)}>{tr("Decline", "Refuser")}</button>
      <button type="button" className={"btn primary" + (big ? " big" : "")} disabled={busy !== null} onClick={() => decide(true)}>{tr("Approve", "Approuver")}</button>
    </>
  );
}

/** A single-use link to pass on by hand (no email is sent). */
export function CopyLink({ link, intro }: { link: string; intro: ReactNode }) {
  const toast = useToast();
  const copy = () =>
    navigator.clipboard?.writeText(link).then(
      () => toast(tr("Link copied.", "Lien copié.")),
      () => toast(tr("Copy failed: select the link and copy it by hand.", "Copie impossible : sélectionnez le lien et copiez-le à la main."), true),
    );
  return (
    <div className="copy-link">
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{intro}</span>
      <div className="row">
        <input readOnly value={link} aria-label={tr("Link", "Lien")} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn primary" onClick={copy}>{tr("Copy", "Copier")}</button>
      </div>
    </div>
  );
}
