/**
 * Sends a human decision back to the workflow that asked for it. For n8n,
 * the callback URL is the resume URL of a "Wait" node: calling it wakes the
 * workflow up with { approved: true | false }.
 */
import { all, run, type DB } from "./db.ts";
import { logActivity, type ApprovalRow } from "./model.ts";

const RETRY_DELAYS = [0, 2_000, 10_000, 30_000, 120_000];

export function callbackBody(a: ApprovalRow) {
  return {
    approval_id: a.id,
    decision: a.status,
    approved: a.status === "approved",
    decided_by: a.decided_by,
    title: a.title,
  };
}

/** Tries a few times, then records the failure in the journal. */
export async function deliverDecision(db: DB, approvalId: number, fetchImpl: typeof fetch = fetch, delays = RETRY_DELAYS): Promise<boolean> {
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const a = all<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", approvalId)[0];
    if (!a?.callback_url || a.status === "pending" || a.callback_status === "sent") return a?.callback_status === "sent";
    try {
      const res = await fetchImpl(a.callback_url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(callbackBody(a)),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        run(db, "UPDATE approvals SET callback_status = 'sent' WHERE id = ?", a.id);
        return true;
      }
      // 404/409: the workflow is no longer waiting (cancelled, timed out). No point retrying.
      if (res.status === 404 || res.status === 409) {
        run(db, "UPDATE approvals SET callback_status = ? WHERE id = ?", `refused_${res.status}`, a.id);
        logActivity(db, "Agent HQ", `Le workflow n'attendait plus la décision « ${a.title} » (il a peut-être été arrêté).`, a.agent_id);
        return false;
      }
    } catch {
      // network error: retry
    }
  }
  run(db, "UPDATE approvals SET callback_status = 'failed' WHERE id = ?", approvalId);
  const a = all<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", approvalId)[0];
  if (a) logActivity(db, "Agent HQ", `Impossible de transmettre la décision « ${a.title} » au workflow.`, a.agent_id);
  return false;
}

/** Only http(s) URLs are accepted as callbacks. */
export function validCallbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
