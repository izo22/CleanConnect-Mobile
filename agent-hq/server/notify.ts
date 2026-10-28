/**
 * Sends a message to the people in charge. Each workspace sets its own chat
 * webhook (Slack, Microsoft Teams, Google Chat or Discord) on its Members page,
 * so a client hears about their own agents only. Platform events (sign-ups,
 * early-access requests) go to NOTIFY_WEBHOOK_URL, the operator's channel,
 * which also serves the first workspace when it has no webhook of its own.
 */
import { MAIN_WORKSPACE, get, type DB } from "./db.ts";
import { tr } from "./i18n.ts";

let muted = false;
/** The demo seed raises dozens of alerts at once: nobody should be pinged for them. */
export const muteNotifications = (on: boolean) => { muted = on; };

/** Each chat tool expects its own shape; the plain {text} suits Slack and Google Chat. */
export function webhookBody(url: string, text: string): object {
  const host = new URL(url).hostname;
  if (/(^|\.)discord(app)?\.com$/.test(host)) return { content: text.slice(0, 2000) };
  if (host.endsWith(".logic.azure.com") || host.endsWith(".powerplatform.com") || host.endsWith(".powerautomate.com")) {
    // Teams "Workflows" webhooks take an Adaptive Card.
    return {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: { $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4", body: [{ type: "TextBlock", text, wrap: true }] },
      }],
    };
  }
  return { text };
}

/** Posts one message; resolves with the receiving server's status (0 when unreachable). */
export async function postToWebhook(url: string, text: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(webhookBody(url, text)),
      signal: AbortSignal.timeout(10_000),
    });
    return res.status;
  } catch (err) {
    console.error("[notification] sending failed:", (err as Error).message);
    return 0;
  }
}

function send(url: string | undefined | null, line: string) {
  if (muted) return;
  if (!url) {
    if (process.env.NODE_ENV !== "test") console.log(`[notification] ${line}`);
    return;
  }
  void postToWebhook(url, line);
}

/** A platform event, for the operator. */
export function notify(text: string) {
  send(process.env.NOTIFY_WEBHOOK_URL, text);
}

/** An event in a client's workspace, for that client's channel. `path` opens the right page, e.g. "/#/decisions". */
export function notifyWorkspace(db: DB, workspaceId: string, text: string, opts: { to?: string; path?: string } = {}) {
  const w = get<{ notify_url: string | null }>(db, "SELECT notify_url FROM workspaces WHERE id = ?", workspaceId);
  const url = w?.notify_url || (workspaceId === MAIN_WORKSPACE ? process.env.NOTIFY_WEBHOOK_URL : undefined);
  const base = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  const lines = [
    opts.to ? `[${tr("for", "pour")} ${opts.to}] ${text}` : text,
    base && opts.path ? `${tr("Open in Orvanta", "Ouvrir dans Orvanta")}: ${base}${opts.path}` : null,
  ];
  send(url, lines.filter(Boolean).join("\n"));
}
