import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { ensureMainRules } from "./auth.ts";
import { callbackBody } from "./callbacks.ts";
import { get, openDb } from "./db.ts";
import type { ApprovalRow } from "./model.ts";

process.env.NODE_ENV = "test";

async function setup() {
  const db = openDb(":memory:");
  ensureMainRules(db, Date.now());
  const app = buildApp({ db, fetchImpl: (async () => new Response("ok")) as typeof fetch });
  const agent = (await app.inject({ method: "POST", url: "/api/agents", payload: { name: "Replies", autonomy: 0 } })).json() as { api_key: string };
  const ask = async (output?: string) => (await app.inject({
    method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${agent.api_key}` },
    payload: { action: "email.send", summary: "Reply to Dana about the delay", ...(output ? { output } : {}) },
  })).json() as { approval_id: number };
  return { db, app, ask };
}

describe("edit & approve", () => {
  it("shows the agent's draft and sends the corrected version back to the workflow", async () => {
    const { db, app, ask } = await setup();
    const { approval_id } = await ask("Hi Dana, we'll give you 40% off for the delay.");
    const list = (await app.inject({ method: "GET", url: "/api/approvals" })).json();
    expect(list.pending[0].output).toBe("Hi Dana, we'll give you 40% off for the delay.");

    const res = await app.inject({ method: "POST", url: `/api/approvals/${approval_id}/decision`, payload: { approve: true, output: "Hi Dana, sorry for the delay, your order ships tomorrow." } });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain("Approved with changes");
    const row = get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", approval_id)!;
    expect(callbackBody(row)).toMatchObject({
      approved: true, edited: true,
      output: "Hi Dana, sorry for the delay, your order ships tomorrow.",
      original_output: "Hi Dana, we'll give you 40% off for the delay.",
    });
  });

  it("keeps the agent's text when the approver approves without editing", async () => {
    const { db, app, ask } = await setup();
    const { approval_id } = await ask("Hi Dana, your order ships tomorrow.");
    await app.inject({ method: "POST", url: `/api/approvals/${approval_id}/decision`, payload: { approve: true } });
    const row = get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", approval_id)!;
    expect(callbackBody(row)).toMatchObject({ approved: true, edited: false, output: "Hi Dana, your order ships tomorrow." });
  });

  it("treats an unchanged text as a plain approval", async () => {
    const { db, app, ask } = await setup();
    const { approval_id } = await ask("Same text");
    await app.inject({ method: "POST", url: `/api/approvals/${approval_id}/decision`, payload: { approve: true, output: "Same text" } });
    expect(get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", approval_id)!.edited_output).toBeNull();
  });

  it("refuses a corrected text on a decline", async () => {
    const { db, app, ask } = await setup();
    const { approval_id } = await ask("Draft");
    const res = await app.inject({ method: "POST", url: `/api/approvals/${approval_id}/decision`, payload: { approve: false, output: "Other" } });
    expect(res.statusCode).toBe(400);
    expect(get<ApprovalRow>(db, "SELECT * FROM approvals WHERE id = ?", approval_id)!.status).toBe("pending");
  });
});
