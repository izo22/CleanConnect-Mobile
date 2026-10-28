import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.ts";
import { openDb, run } from "./db.ts";
import { upsertAlert } from "./engine.ts";
import { HOUR, newApiKey } from "./model.ts";
import { notifyWorkspace, webhookBody } from "./notify.ts";
import { seed } from "./seed.ts";

process.env.NODE_ENV = "test";

const NOW = Date.UTC(2026, 9, 28, 14, 0, 0);
const CODE = "a-very-long-secret-123";
const SLACK_A = "https://hooks.slack.com/services/T000/B000/acme";
const SLACK_B = "https://hooks.slack.com/services/T000/B000/globex";

/** Catches what Orvanta posts to chat tools. */
function chat(status = 200) {
  const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    posts.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response("ok", { status });
  });
  vi.stubGlobal("fetch", fetchImpl);
  return { posts, fetchImpl: fetchImpl as unknown as typeof fetch };
}
const settle = () => new Promise((r) => setTimeout(r, 10));

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NOTIFY_WEBHOOK_URL;
  delete process.env.PUBLIC_URL;
});

async function twoClients(fetchImpl?: typeof fetch) {
  const db = openDb(":memory:");
  const app = buildApp({ db, adminToken: CODE, now: () => NOW, fetchImpl });
  const admin = { "x-admin-token": CODE };
  const make = async (name: string) => (await app.inject({ method: "POST", url: "/api/workspaces", headers: admin, payload: { name } })).json().id as string;
  const acme = await make("Acme");
  const globex = await make("Globex");
  const key = newApiKey();
  run(db, "INSERT INTO agents (id, workspace_id, name, mission, owner_name, owner_email, autonomy, budget_cents, api_key, created_at) VALUES ('refunds', ?, 'Refunds', '', 'Ana', 'ana@acme.com', 2, 100000, ?, ?)", acme, key, NOW - 30 * 24 * HOUR);
  const asWs = (ws: string) => ({ ...admin, "x-workspace": ws });
  return { db, app, acme, globex, key, asWs };
}

describe("notifications per workspace", () => {
  it("speaks each chat tool's format", () => {
    expect(webhookBody(SLACK_A, "Hi")).toEqual({ text: "Hi" });
    expect(webhookBody("https://chat.googleapis.com/v1/spaces/x/messages?key=k", "Hi")).toEqual({ text: "Hi" });
    expect(webhookBody("https://discord.com/api/webhooks/1/abc", "Hi")).toEqual({ content: "Hi" });
    const teams = webhookBody("https://prod-00.westus.logic.azure.com/workflows/abc", "Hi") as { attachments: Array<{ content: { body: Array<{ text: string }> } }> };
    expect(teams.attachments[0].content.body[0].text).toBe("Hi");
  });

  it("lets an owner set the channel and send a test message", async () => {
    const { posts, fetchImpl } = chat();
    const { app, acme, asWs } = await twoClients(fetchImpl);
    const patch = (notify_url: string) => app.inject({ method: "PATCH", url: "/api/workspace", headers: asWs(acme), payload: { notify_url } });
    expect((await patch("http://10.0.0.5/hook")).statusCode).toBe(400);
    expect((await patch(SLACK_A)).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/workspace", headers: asWs(acme) })).json().notify_url).toBe(SLACK_A);

    const test = await app.inject({ method: "POST", url: "/api/workspace/notify-test", headers: asWs(acme) });
    expect(test.statusCode).toBe(200);
    expect(posts).toEqual([{ url: SLACK_A, body: { text: expect.stringContaining("“Acme”") } }]);
  });

  it("says so when the chat tool refuses the test message", async () => {
    const { fetchImpl } = chat(404);
    const { app, acme, asWs } = await twoClients(fetchImpl);
    await app.inject({ method: "PATCH", url: "/api/workspace", headers: asWs(acme), payload: { notify_url: SLACK_A } });
    const test = await app.inject({ method: "POST", url: "/api/workspace/notify-test", headers: asWs(acme) });
    expect(test.statusCode).toBe(502);
    expect(test.json().error).toContain("error 404");
  });

  it("posts an approval request to that client's channel only, with a link to decide", async () => {
    const { posts } = chat();
    process.env.PUBLIC_URL = "https://app.orvantahq.io";
    const { db, app, acme, globex, key, asWs } = await twoClients();
    for (const [ws, url] of [[acme, SLACK_A], [globex, SLACK_B]]) {
      await app.inject({ method: "PATCH", url: "/api/workspace", headers: asWs(ws), payload: { notify_url: url } });
    }
    const res = await app.inject({
      method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${key}` },
      payload: { action: "stripe.refund", amount_cents: 34000, summary: "Refund $340 to Harbor Grill" },
    });
    expect(res.json().decision).toBe("needs_approval");
    await settle();
    expect(posts.map((p) => p.url)).toEqual([SLACK_A]);
    expect(posts[0].body.text).toContain("Refunds is waiting for your approval: Refund $340 to Harbor Grill");
    expect(posts[0].body.text).toContain("https://app.orvantahq.io/#/decisions");
  });

  it("posts new alerts, and falls back to the operator's channel only for the first workspace", async () => {
    const { posts } = chat();
    process.env.NOTIFY_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/operator";
    const { db, acme } = await twoClients();
    upsertAlert(db, "refunds", { kind: "errors", severity: "critical", title: "12 failed refunds", cause: "c", impact: "i" }, NOW);
    notifyWorkspace(db, "main", "first workspace event");
    notifyWorkspace(db, acme, "client event without a channel");
    await settle();
    // The client has no channel yet: its alert is not sent to the operator.
    expect(posts).toEqual([{ url: process.env.NOTIFY_WEBHOOK_URL, body: { text: "first workspace event" } }]);

    run(db, "UPDATE workspaces SET notify_url = ? WHERE id = ?", SLACK_A, acme);
    upsertAlert(db, "refunds", { kind: "auth", severity: "blocked", title: "HubSpot access expired", cause: "c", impact: "i" }, NOW);
    await settle();
    expect(posts.at(-1)).toEqual({ url: SLACK_A, body: { text: "🔴 Refunds: HubSpot access expired" } });
  });

  it("stays quiet while the demo is being built", async () => {
    const { posts } = chat();
    process.env.NOTIFY_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/operator";
    seed(openDb(":memory:"), NOW);
    await settle();
    expect(posts).toEqual([]);
  });

  it("keeps the webhook address from members and viewers", async () => {
    chat();
    const { app, acme, asWs } = await twoClients();
    await app.inject({ method: "PATCH", url: "/api/workspace", headers: asWs(acme), payload: { notify_url: SLACK_A } });
    const created = (await app.inject({ method: "POST", url: "/api/workspace/invites", headers: asWs(acme), payload: { email: "max@acme.com", role: "member" } })).json();
    const token = created.link.split("/#/link/")[1];
    const joined = await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: { name: "Max", password: "correct horse battery" } });
    const cookie = String(joined.headers["set-cookie"]).split(";")[0];
    const view = (await app.inject({ url: "/api/workspace", headers: { cookie, "x-workspace": acme } })).json();
    expect(view.notify_url).toBeNull();
    expect((await app.inject({ method: "PATCH", url: "/api/workspace", headers: { cookie, "x-workspace": acme }, payload: { notify_url: SLACK_B } })).statusCode).toBe(403);
  });
});
