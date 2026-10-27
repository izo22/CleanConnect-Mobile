import { currency, lang, locale, tr } from "./i18n.ts";

export const money = (cents: number | null | undefined, digits?: number) => {
  if (cents == null) return "—";
  const v = cents / 100;
  const d = digits ?? (Math.abs(v) >= 100 ? 0 : 2);
  return v.toLocaleString(locale(), { style: "currency", currency: currency(), minimumFractionDigits: d, maximumFractionDigits: d });
};

export const num = (n: number) => Math.round(n).toLocaleString(locale());

export const pct = (r: number | null) => (r == null ? "—" : Math.round(r * 100) + tr("%", " %"));

const time = (d: Date) => {
  const t = d.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });
  return lang() === "fr" ? t.replace(":", " h ") : t;
};

export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return tr("just now", "à l'instant");
  const m = Math.round(s / 60);
  if (m < 60) return tr(`${m} min ago`, `il y a ${m} min`);
  const d = new Date(ts);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return tr(`today, ${time(d)}`, `aujourd'hui, ${time(d)}`);
  const yesterday = new Date(now - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return tr(`yesterday, ${time(d)}`, `hier, ${time(d)}`);
  return d.toLocaleDateString(locale(), { day: "numeric", month: "short" }) + `, ${time(d)}`;
}

export const shortTime = (ts: number) => {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(locale(), { day: "numeric", month: "short" });
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

/** French treats 0 as singular, English as plural. */
export const many = (n: number) => (lang() === "fr" ? n > 1 : n !== 1);

export const plural = (n: number, one: string, other: string) => `${num(n)} ${many(n) ? other : one}`;

/** Where the currency symbol goes around an amount: "$" before (en-US), " €" after (fr-FR). */
export function currencyAffix(): { before: string; after: string } {
  const parts = new Intl.NumberFormat(locale(), { style: "currency", currency: currency() }).formatToParts(1);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency();
  const before = parts.findIndex((p) => p.type === "currency") < parts.findIndex((p) => p.type === "integer");
  return before ? { before: symbol, after: "" } : { before: "", after: ` ${symbol}` };
}

/** Reads a number typed by the user: "1,250.5" in English, "1 250,5" in French. */
export const parseNumber = (text: string) =>
  Number(lang() === "fr" ? text.replace(/[\s ]/g, "").replace(",", ".") : text.replace(/[,\s]/g, ""));
