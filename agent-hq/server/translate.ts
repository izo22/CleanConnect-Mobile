/**
 * Turns raw technical errors into plain French a manager can act on.
 * Matching is done on the error code first, then on the message text,
 * so agents built on any platform get a sensible translation.
 */

export type ErrorFamily = "auth" | "rate_limit" | "timeout" | "not_found" | "invalid_input" | "model" | "unknown";

export interface Translation {
  family: ErrorFamily;
  /** Short French phrase, e.g. "son accès à HubSpot a expiré". */
  cause: string;
  /** Whether the agent cannot work at all until a human fixes it. */
  blocking: boolean;
}

const PATTERNS: Array<{ family: ErrorFamily; test: RegExp }> = [
  { family: "auth", test: /\b(401|403)\b|auth|unauthori[sz]ed|forbidden|token.*(expired|invalid)|expired.*token|invalid[_ ]?api[_ ]?key|permission/i },
  { family: "rate_limit", test: /\b429\b|rate.?limit|too many requests|quota|overloaded/i },
  { family: "timeout", test: /timeout|timed out|ETIMEDOUT|ECONNRESET|\b50[234]\b|unavailable/i },
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
  const on = tool ? ` à ${toolLabel(tool)}` : "";
  const of = tool ? ` de ${toolLabel(tool)}` : "";
  switch (family) {
    case "auth":
      return { family, blocking: true, cause: `son accès${on} a expiré ou a été retiré.` };
    case "rate_limit":
      return { family, blocking: true, cause: `le service${of || " du fournisseur"} le bloque temporairement : il envoie trop de demandes.` };
    case "timeout":
      return { family, blocking: false, cause: `le service${of || " qu'il utilise"} ne répond pas ou répond trop lentement.` };
    case "not_found":
      return { family, blocking: false, cause: `il cherche des éléments qui n'existent plus${tool ? " dans " + toolLabel(tool) : ""}.` };
    case "invalid_input":
      return { family, blocking: false, cause: `il envoie des informations mal remplies${on}.` };
    case "model":
      return { family, blocking: false, cause: "le modèle d'IA refuse ou n'arrive pas à traiter certaines demandes (trop longues ou filtrées)." };
    default:
      return { family, blocking: false, cause: "il rencontre des erreurs répétées que nous n'avons pas pu identifier précisément." };
  }
}

const TOOL_NAMES: Record<string, string> = {
  hubspot: "HubSpot",
  gmail: "Gmail",
  email: "la messagerie",
  stripe: "Stripe",
  zendesk: "Zendesk",
  slack: "Slack",
  notion: "Notion",
  pennylane: "Pennylane",
  qonto: "Qonto",
  shopify: "Shopify",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

/** "hubspot.update" → "HubSpot" */
export function toolLabel(actionOrTool: string): string {
  const key = actionOrTool.split(/[.:/]/)[0].toLowerCase();
  return TOOL_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

const ACTION_VERBS: Record<string, string> = {
  send: "envoi",
  reply: "réponse",
  update: "mise à jour",
  create: "création",
  refund: "remboursement",
  delete: "suppression",
  post: "publication",
};

/** "email.send" → "envoi (la messagerie)" — used in alert titles. */
export function actionLabel(action: string): string {
  const [tool, verb] = action.split(".");
  const v = verb ? ACTION_VERBS[verb] ?? verb : action;
  return verb ? `${v} via ${toolLabel(tool)}` : v;
}

export function languageName(code: string): string {
  const names: Record<string, string> = { fr: "français", en: "anglais", es: "espagnol", de: "allemand", it: "italien", pt: "portugais", nl: "néerlandais" };
  return names[code.toLowerCase()] ?? code;
}
