export const euros = (cents: number | null | undefined, digits?: number) => {
  if (cents == null) return "—";
  const v = cents / 100;
  const d = digits ?? (Math.abs(v) >= 100 ? 0 : 2);
  return v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €";
};

export const num = (n: number) => Math.round(n).toLocaleString("fr-FR");

export const pct = (r: number | null) => (r == null ? "—" : Math.round(r * 100) + " %");

export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const d = new Date(ts);
  const today = new Date(now);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `aujourd'hui, ${time}`;
  const yesterday = new Date(now - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return `hier, ${time}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + `, ${time}`;
}

export const shortTime = (ts: number) => {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

const AVATARS: Array<[string, string]> = [
  ["#FFE1D6", "#9A3412"],
  ["#E3DCFF", "#3B2F87"],
  ["#D4F4E4", "#0E6B3F"],
  ["#FFF0C2", "#7A4D00"],
  ["#DCEBFF", "#1D4E89"],
  ["#FFDDEB", "#8E1F52"],
];

export function avatarColors(id: string): [string, string] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

export const initials = (name: string) =>
  name.replace(/·.*$/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const plural = (n: number, one: string, many: string) => `${num(n)} ${n > 1 ? many : one}`;
