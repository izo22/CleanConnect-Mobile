import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { openDb } from "./db.ts";

process.env.NODE_ENV = "test";

const NOW = Date.UTC(2026, 9, 27, 15, 0, 0);
const form = { name: " Dana Brooks ", email: "Dana@Brightline.co", company: "Brightline Automations", tools: ["n8n", "Zapier"], fleet: "10-50", message: "We run 30 agents for clients." };

describe("early access form", () => {
  it("stores a request sent from the public site and lists it in the dashboard only", async () => {
    const app = buildApp({ db: openDb(":memory:"), adminToken: "a-very-long-secret-123", now: () => NOW });
    const res = await app.inject({ method: "POST", url: "/api/public/early-access", payload: form });
    expect(res.statusCode).toBe(201);

    expect((await app.inject({ url: "/api/early-access" })).statusCode).toBe(401);
    const list = (await app.inject({ url: "/api/early-access", headers: { "x-admin-token": "a-very-long-secret-123" } })).json();
    expect(list).toEqual([
      expect.objectContaining({ name: "Dana Brooks", email: "dana@brightline.co", company: "Brightline Automations", tools: ["n8n", "Zapier"], fleet: "10-50", created_at: NOW }),
    ]);
    const overview = (await app.inject({ url: "/api/overview", headers: { "x-admin-token": "a-very-long-secret-123" } })).json();
    expect(overview.early_access).toBe(1);
  });

  it("refuses an invalid email and silently drops bots that fill the hidden field", async () => {
    const db = openDb(":memory:");
    const app = buildApp({ db, now: () => NOW });
    expect((await app.inject({ method: "POST", url: "/api/public/early-access", payload: { name: "X", email: "not-an-email" } })).statusCode).toBe(400);
    const bot = await app.inject({ method: "POST", url: "/api/public/early-access", payload: { ...form, website: "http://spam.example" } });
    expect(bot.statusCode).toBe(201);
    expect((await app.inject({ url: "/api/early-access" })).json()).toEqual([]);
  });

  it("limits each visitor to 5 requests an hour", async () => {
    let t = NOW;
    const app = buildApp({ db: openDb(":memory:"), now: () => t });
    const send = () => app.inject({ method: "POST", url: "/api/public/early-access", payload: form, remoteAddress: "203.0.113.9" });
    for (let i = 0; i < 5; i++) expect((await send()).statusCode).toBe(201);
    expect((await send()).statusCode).toBe(429);
    // another visitor is not affected
    expect((await app.inject({ method: "POST", url: "/api/public/early-access", payload: form, remoteAddress: "198.51.100.4" })).statusCode).toBe(201);
    t += 61 * 60_000;
    expect((await send()).statusCode).toBe(201);
  });
});
