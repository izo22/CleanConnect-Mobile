/**
 * The interface follows the server's language (APP_LANGUAGE): English with
 * dollars by default, French with euros. Loaded once, before the first render.
 */
export type Lang = "en" | "fr";

let current: { language: Lang; currency: string } = { language: "en", currency: "USD" };

export async function loadLocale() {
  try {
    const res = await fetch("/api/locale");
    if (res.ok) current = await res.json();
  } catch {
    // server unreachable: keep English, the next screen shows the error
  }
  document.documentElement.lang = current.language;
}

export const lang = () => current.language;
export const currency = () => current.currency;
export const locale = () => (current.language === "fr" ? "fr-FR" : "en-US");

/** Picks the text for the current language: tr("Paused", "En pause"). */
export const tr = (en: string, fr: string) => (current.language === "fr" ? fr : en);
