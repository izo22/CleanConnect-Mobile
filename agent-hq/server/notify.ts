/**
 * Sends a message to the people in charge. Set NOTIFY_WEBHOOK_URL to a
 * Slack- or Teams-compatible incoming webhook to get real messages;
 * without it, notifications are only written to the server log.
 */
import { tr } from "./i18n.ts";

export function notify(text: string, to?: string) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  const line = to ? `[${tr("for", "pour")} ${to}] ${text}` : text;
  if (!url) {
    if (process.env.NODE_ENV !== "test") console.log(`[notification] ${line}`);
    return;
  }
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: line }),
  }).catch((err) => console.error("[notification] sending failed:", err.message));
}
