/**
 * Turns raw technical errors into plain words a manager can act on.
 * Matching is done on the error code first, then on the message text,
 * so agents built on any platform get a sensible translation.
 */

import { tr } from "./i18n.ts";

export type ErrorFamily = "auth" | "rate_limit" | "timeout" | "not_found" | "invalid_input" | "model" | "unknown";

export interface Translation {
  family: ErrorFamily;
  /** Short phrase, e.g. "its access to HubSpot has expired". */
  cause: string;
  /** Whether the agent cannot work at all until a human fixes it. */
  blocking: boolean;
}

const PATTERNS: Array<{ family: ErrorFamily; test: RegExp }> = [
  { family: "auth", test: /\b(401|403)\b|auth|unauthori[sz]ed|forbidden|token.*(expired|invalid)|expired.*token|invalid[_ ]?api[_ ]?key|permission/i },
  { family: "rate_limit", test: /\b429\b|rate.?limit|too many requests|quota|overloaded/i },
  { family: "timeout", test: /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|\b50[234]\b|unavailable/i },
  { family: "not_found", test: /\b404\b|not.?found|does not exist/i },
  { family: "invalid_input", test: /\b(400|422)\b|invalid|validation|malformed|schema/i },
  { family: "model", test: /context.?length|max.?tokens|content.?filter|refus/i },
];

export function classifyError(code: string | null | undefined, message: string | null | undefined): ErrorFamily {
  const text = `${code ?? ""} ${message ?? ""}`;
  for (const p of PATTERNS) if (p.test.test(text)) return p.family;
  return "unknown";
}

export function translateError(family: ErrorFamily, tool: string | null): Translation {
  const name = tool ? toolLabel(tool) : null;
  const on = name ? tr(` to ${name}`, ` à ${name}`) : "";
  switch (family) {
    case "auth":
      return { family, blocking: true, cause: tr(`its access${on} has expired or was revoked.`, `son accès${on} a expiré ou a été retiré.`) };
    case "rate_limit":
      return {
        family,
        blocking: true,
        cause: tr(
          `${name ?? "the provider"} is temporarily blocking it: it sends too many requests.`,
          `le service${name ? " de " + name : " du fournisseur"} le bloque temporairement : il envoie trop de demandes.`,
        ),
      };
    case "timeout":
      return {
        family,
        blocking: false,
        cause: tr(
          `${name ?? "a service it uses"} is not responding, or too slowly.`,
          `le service${name ? " de " + name : " qu'il utilise"} ne répond pas ou répond trop lentement.`,
        ),
      };
    case "not_found":
      return {
        family,
        blocking: false,
        cause: tr(
          `it is looking for items that no longer exist${name ? " in " + name : ""}.`,
          `il cherche des éléments qui n'existent plus${name ? " dans " + name : ""}.`,
        ),
      };
    case "invalid_input":
      return { family, blocking: false, cause: tr(`it sends badly filled-in information${on}.`, `il envoie des informations mal remplies${on}.`) };
    case "model":
      return {
        family,
        blocking: false,
        cause: tr(
          "the AI model refuses or fails to handle some requests (too long or filtered).",
          "le modèle d'IA refuse ou n'arrive pas à traiter certaines demandes (trop longues ou filtrées).",
        ),
      };
    default:
      return {
        family,
        blocking: false,
        cause: tr("it keeps hitting errors we could not pin down.", "il rencontre des erreurs répétées que nous n'avons pas pu identifier précisément."),
      };
  }
}

const TOOL_NAMES: Record<string, string> = {
  hubspot: "HubSpot",
  gmail: "Gmail",
  stripe: "Stripe",
  zendesk: "Zendesk",
  slack: "Slack",
  notion: "Notion",
  pennylane: "Pennylane",
  quickbooks: "QuickBooks",
  qonto: "Qonto",
  shopify: "Shopify",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

/** "hubspot.update" → "HubSpot" */
export function toolLabel(actionOrTool: string): string {
  const raw = actionOrTool.split(/[.:/]/)[0].trim();
  const key = raw.toLowerCase();
  if (key === "email") return tr("email", "la messagerie");
  return TOOL_NAMES[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

const ENGLISH_NOUNS: Record<string, string> = {
  send: "sends",
  reply: "replies",
  update: "updates",
  create: "entries",
  refund: "refunds",
  delete: "deletions",
  post: "posts",
};

const FRENCH_VERBS: Record<string, string> = {
  send: "envoi",
  reply: "réponse",
  update: "mise à jour",
  create: "création",
  refund: "remboursement",
  delete: "suppression",
  post: "publication",
};

/** "stripe.refund" → "Stripe refunds" / "remboursement via Stripe" — used in alert titles. */
export function actionLabel(action: string): string {
  const [tool, verb] = action.split(".");
  if (!verb) return action;
  return tr(`${toolLabel(tool)} ${ENGLISH_NOUNS[verb] ?? verb}`, `${FRENCH_VERBS[verb] ?? verb} via ${toolLabel(tool)}`);
}

const LANGUAGES: Record<string, [string, string]> = {
  fr: ["French", "français"],
  en: ["English", "anglais"],
  es: ["Spanish", "espagnol"],
  de: ["German", "allemand"],
  it: ["Italian", "italien"],
  pt: ["Portuguese", "portugais"],
  nl: ["Dutch", "néerlandais"],
};

export function languageName(code: string): string {
  const names = LANGUAGES[code.toLowerCase()];
  return names ? tr(...names) : code;
}
