/**
 * Language of an instance: English by default (US dollars, New York time),
 * French with APP_LANGUAGE=fr (euros, Paris time). CURRENCY and TIMEZONE
 * override the defaults. Text stored in the database (alerts, journal) is
 * written in the language active when it was created.
 */
export type Lang = "en" | "fr";

export const lang = (): Lang => (/^fr/i.test(process.env.APP_LANGUAGE ?? "") ? "fr" : "en");

/** Picks the sentence for the instance language: tr("Paused", "En pause"). */
export const tr = (en: string, fr: string) => (lang() === "fr" ? fr : en);

export const locale = () => (lang() === "fr" ? "fr-FR" : "en-US");
export const currency = () => (process.env.CURRENCY || (lang() === "fr" ? "EUR" : "USD")).toUpperCase();
export const timezone = () => process.env.TIMEZONE || (lang() === "fr" ? "Europe/Paris" : "America/New_York");

/** 34000 → "$340" or "340 €"; cents are shown only when there are some. */
export function money(cents: number): string {
  const digits = Math.round(cents) % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale(), { style: "currency", currency: currency(), minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
}

export const num = (n: number, maxDigits = 0) => n.toLocaleString(locale(), { maximumFractionDigits: maxDigits });

/** French treats 0 as singular, English as plural. */
export const many = (n: number) => (lang() === "fr" ? n > 1 : n !== 1);

/** 22 → "10 pm" or "22 h". */
export const hourLabel = (h: number) => (lang() === "fr" ? `${h} h` : `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`);
