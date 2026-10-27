import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { HOUR, newApiKey } from "./model.ts";

process.env.NODE_ENV = "test";

const NOW = Date.UTC(2026, 9, 27, 15, 0, 0);
const CODE = "a-very-long-secret-123";
const PASSWORD = "correct horse battery";

type App = ReturnType<typeof buildApp>;

const cookieOf = (res: { headers: Record<string, unknown> }) => String(res.headers["set-cookie"] ?? "").split(";")[0];

/** A person's browser: keeps their session cookie and current workspace. */
function browser(app: App, cookie: string, ws?: string) {
  const headers = () => ({ cookie, ...(ws ? { "x-workspace": ws } : {}) });
  return {
    cookie,
    get: (url: string) => app.inject({ url, headers: headers() }),
    send: (method: "POST" | "PATCH" | "DELETE", url: string, payload?: object) => app.inject({ method, url, headers: headers(), ...(payload ? { payload } : {}) }),
    in: (other: string) => browser(app, cookie, other),
  };
}

async function setup(db: DB = openDb(":memory:")) {
  let t = NOW;
  const app = buildApp({ db, adminToken: CODE, now: () => t });
  const res = await app.inject({ method: "POST", url: "/api/auth/setup", payload: { setup_code: CODE, name: "Alice", email: "Alice@Agency.io", password: PASSWORD } });
  expect(res.statusCode).toBe(201);
  return { app, db, alice: browser(app, cookieOf(res)), tick: (ms: number) => (t += ms) };
}

/** The owner creates an invitation, the invited person opens the link and joins. */
async function invite(app: App, owner: ReturnType<typeof browser>, email: string, role: string, name = email.split("@")[0]) {
  const created = await owner.send("POST", "/api/workspace/invites", { email, role });
  expect(created.statusCode).toBe(201);
  const token = created.json().link.split("/#/link/")[1];
  const joined = await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: { name, password: PASSWORD } });
  expect(joined.statusCode).toBe(200);
  return { person: browser(app, cookieOf(joined)), token, me: joined.json() };
}

function addAgent(db: DB, id: string, ws: string) {
  run(
    db,
    "INSERT INTO agents (id, workspace_id, name, mission, owner_name, owner_email, autonomy, budget_cents, api_key, created_at) VALUES (?, ?, ?, '', '', '', 2, 100000, ?, ?)",
    id, ws, id, newApiKey(), NOW - 30 * 24 * HOUR,
  );
}

describe("first account", () => {
  it("is created once, with the setup code, and becomes the platform administrator", async () => {
    const app = buildApp({ db: openDb(":memory:"), adminToken: CODE, now: () => NOW });
    expect((await app.inject({ url: "/api/auth/state" })).json()).toEqual({ mode: "accounts", setup_needed: true, signup: false, google: false });
    expect((await app.inject({ url: "/api/overview" })).statusCode).toBe(401);

    const attempt = (setup_code: string, password = PASSWORD) =>
      app.inject({ method: "POST", url: "/api/auth/setup", payload: { setup_code, name: "Alice", email: "alice@agency.io", password } });
    expect((await attempt("wrong-code")).statusCode).toBe(403);
    expect((await attempt(CODE, "short")).statusCode).toBe(400);

    const ok = await attempt(CODE);
    expect(ok.statusCode).toBe(201);
    expect(ok.headers["set-cookie"]).toMatch(/orvanta_session=.+; Path=\/; HttpOnly; SameSite=Lax/);
    expect(ok.json()).toMatchObject({ mode: "accounts", user: { name: "Alice", email: "alice@agency.io", is_admin: true }, workspaces: [{ id: "main", role: "owner" }] });

    expect((await attempt(CODE)).statusCode).toBe(409);
    expect((await app.inject({ url: "/api/auth/state" })).json().setup_needed).toBe(false);
    expect((await app.inject({ url: "/api/overview", headers: { cookie: cookieOf(ok) } })).statusCode).toBe(200);
  });

  it("stores the password hashed, never in clear", async () => {
    const { db } = await setup();
    const row = get<{ password_hash: string }>(db, "SELECT password_hash FROM users")!;
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain(PASSWORD);
  });
});

describe("signing in", () => {
  it("opens a session with the right password and closes it on sign out", async () => {
    const { app } = await setup();
    const login = (password: string) => app.inject({ method: "POST", url: "/api/auth/login", payload: { email: " ALICE@agency.io ", password } });
    expect((await login("wrong password")).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "nobody@agency.io", password: PASSWORD } })).statusCode).toBe(401);

    const ok = await login(PASSWORD);
    expect(ok.statusCode).toBe(200);
    const cookie = cookieOf(ok);
    expect((await app.inject({ url: "/api/me", headers: { cookie } })).json().user.name).toBe("Alice");

    await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect((await app.inject({ url: "/api/me", headers: { cookie } })).statusCode).toBe(401);
  });

  it("slows down password guessing", async () => {
    const { app } = await setup();
    const guess = () => app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "alice@agency.io", password: "guess-guess" } });
    for (let i = 0; i < 10; i++) expect((await guess()).statusCode).toBe(401);
    expect((await guess()).statusCode).toBe(429);
  });

  it("expires sessions after 30 days", async () => {
    const { alice, tick } = await setup();
    expect((await alice.get("/api/me")).statusCode).toBe(200);
    tick(31 * 24 * HOUR);
    expect((await alice.get("/api/me")).statusCode).toBe(401);
  });

  it("refuses actions posted from another site", async () => {
    const { app, alice } = await setup();
    const res = await app.inject({ method: "POST", url: "/api/workspaces", headers: { cookie: alice.cookie, origin: "https://evil.example" }, payload: { name: "X" } });
    expect(res.statusCode).toBe(403);
  });
});

describe("invitations", () => {
  it("lets a new person join a client workspace with a single-use link", async () => {
    const { app, alice } = await setup();
    const ws = (await alice.send("POST", "/api/workspaces", { name: "Acme Corp" })).json();
    expect(ws).toMatchObject({ name: "Acme Corp", role: "owner" });
    const owner = alice.in(ws.id);

    const created = (await owner.send("POST", "/api/workspace/invites", { email: "Bob@Acme.com", role: "member" })).json();
    const token = created.link.split("/#/link/")[1];
    expect((await app.inject({ url: `/api/auth/link/${token}` })).json()).toMatchObject({ kind: "invite", email: "bob@acme.com", role: "member", workspace: "Acme Corp", account_exists: false });
    expect((await owner.get("/api/workspace")).json().invites).toHaveLength(1);

    const joined = await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: { name: "Bob", password: PASSWORD } });
    expect(joined.statusCode).toBe(200);
    // Bob only sees Acme, not the agency's own workspace.
    expect(joined.json().workspaces).toEqual([{ id: ws.id, name: "Acme Corp", role: "member" }]);
    expect(joined.json().user.is_admin).toBe(false);

    // The link works once.
    expect((await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: { name: "Eve", password: PASSWORD } })).statusCode).toBe(404);
    expect((await owner.get("/api/workspace")).json().members.map((m: { name: string }) => m.name)).toEqual(["Alice", "Bob"]);
  });

  it("asks a person who already has an account for their password", async () => {
    const { app, alice } = await setup();
    const a = (await alice.send("POST", "/api/workspaces", { name: "Client A" })).json().id;
    const b = (await alice.send("POST", "/api/workspaces", { name: "Client B" })).json().id;
    await invite(app, alice.in(a), "sam@agency.io", "member", "Sam");

    const token = (await alice.in(b).send("POST", "/api/workspace/invites", { email: "sam@agency.io", role: "viewer" })).json().link.split("/#/link/")[1];
    expect((await app.inject({ url: `/api/auth/link/${token}` })).json().account_exists).toBe(true);
    expect((await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: { password: "not his password" } })).statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: { password: PASSWORD } });
    expect(ok.json().workspaces.map((w: { name: string; role: string }) => `${w.name}:${w.role}`)).toEqual(["Client A:member", "Client B:viewer"]);
  });

  it("expires after 7 days and can be cancelled", async () => {
    const { app, alice, tick } = await setup();
    const link = (await alice.send("POST", "/api/workspace/invites", { email: "late@agency.io", role: "member" })).json().link;
    tick(8 * 24 * HOUR);
    expect((await app.inject({ url: `/api/auth/link/${link.split("/#/link/")[1]}` })).statusCode).toBe(404);

    await alice.send("POST", "/api/workspace/invites", { email: "x@agency.io", role: "member" });
    const id = (await alice.get("/api/workspace")).json().invites[0].id;
    expect((await alice.send("DELETE", `/api/workspace/invites/${id}`)).statusCode).toBe(200);
    expect((await alice.get("/api/workspace")).json().invites).toEqual([]);
  });
});

describe("client data stays in its workspace", () => {
  it("never lets a client read or change another client's agents, alerts, decisions or rules", async () => {
    const { app, db, alice } = await setup();
    const acme = (await alice.send("POST", "/api/workspaces", { name: "Acme" })).json().id;
    const globex = (await alice.send("POST", "/api/workspaces", { name: "Globex" })).json().id;
    addAgent(db, "acme-refunds", acme);
    addAgent(db, "globex-bot", globex);
    run(db, "INSERT INTO alerts (agent_id, kind, severity, title, cause, impact, created_at, updated_at) VALUES ('acme-refunds', 'errors', 'critical', 'Acme alert', 'c', 'i', ?, ?)", NOW, NOW);
    run(db, "INSERT INTO approvals (agent_id, action, title, reason, created_at) VALUES ('acme-refunds', 'stripe.refund', 'Refund $900', 'over limit', ?)", NOW);
    run(db, "INSERT INTO events (agent_id, ts, kind, success) VALUES ('acme-refunds', ?, 'task', 1)", NOW);
    run(db, "INSERT INTO reviews (event_id, agent_id, verdict, score, summary, reviewer, created_at) VALUES (1, 'acme-refunds', 'error', 2, 'Wrong total', 'test', ?)", NOW);
    run(db, "INSERT INTO integrations (kind, workspace_id, name, base_url, api_key, created_at) VALUES ('n8n', ?, 'Acme n8n', 'https://n8n.acme.test', 'secret-acme-key', ?)", acme, NOW);
    const alertId = get<{ id: number }>(db, "SELECT id FROM alerts")!.id;
    const approvalId = get<{ id: number }>(db, "SELECT id FROM approvals")!.id;
    const integrationId = get<{ id: number }>(db, "SELECT id FROM integrations")!.id;

    const { person: gina } = await invite(app, alice.in(globex), "gina@globex.com", "owner", "Gina");
    const g = gina.in(globex);

    // Lists only show Globex.
    expect((await g.get("/api/agents")).json().map((a: { id: string }) => a.id)).toEqual(["globex-bot"]);
    expect((await g.get("/api/alerts")).json()).toEqual({ open: [], resolved: [] });
    expect((await g.get("/api/approvals")).json()).toEqual({ pending: [], decided: [] });
    expect((await g.get("/api/integrations")).json()).toEqual([]);
    expect((await g.get("/api/rules")).json().every((r: { id: string }) => r.id.startsWith(`${globex}:`))).toBe(true);
    expect((await g.get("/api/overview")).json().counts.total).toBe(1);

    // Asking for Acme directly is refused.
    expect((await gina.in(acme).get("/api/agents")).statusCode).toBe(403);
    expect((await gina.in("main").get("/api/agents")).statusCode).toBe(403);

    // Acme's ids read as "not found" from Globex.
    const acmeRule = `${acme}:refunds`;
    const attempts = [
      g.get("/api/agents/acme-refunds"),
      g.send("PATCH", "/api/agents/acme-refunds", { name: "hijacked" }),
      g.send("POST", "/api/agents/acme-refunds/actions/pause"),
      g.send("POST", "/api/agents/acme-refunds/rotate-key"),
      g.send("POST", "/api/agents/acme-refunds/reports", { description: "fake report" }),
      g.get("/api/agents/acme-refunds/n8n-snippet"),
      g.send("POST", `/api/alerts/${alertId}/actions/pause`),
      g.send("POST", `/api/approvals/${approvalId}/decision`, { approve: true }),
      g.send("POST", "/api/reviews/1/verdict", { confirmed: true }),
      g.send("PATCH", `/api/rules/${acmeRule}`, { enabled: false }),
      g.send("POST", `/api/integrations/${integrationId}/sync`),
      g.send("DELETE", `/api/integrations/${integrationId}`),
    ];
    for (const res of await Promise.all(attempts)) expect(res.statusCode).toBe(404);

    // Nothing moved on Acme's side.
    expect(get(db, "SELECT name, paused FROM agents WHERE id = 'acme-refunds'")).toEqual({ name: "acme-refunds", paused: 0 });
    expect(get(db, "SELECT status FROM approvals")).toEqual({ status: "pending" });
    expect(get(db, "SELECT enabled FROM rules WHERE id = ?", acmeRule)).toEqual({ enabled: 1 });
    expect(get(db, "SELECT COUNT(*) n FROM integrations")).toEqual({ n: 1 });
    expect(get(db, "SELECT COUNT(*) n FROM reports")).toEqual({ n: 0 });
  });

  it("gives every new workspace its own guardrails and an empty journal", async () => {
    const { alice } = await setup();
    const ws = (await alice.send("POST", "/api/workspaces", { name: "Initech" })).json().id;
    const rules = (await alice.in(ws).get("/api/rules")).json();
    expect(rules.map((r: { kind: string }) => r.kind).sort()).toEqual(["approval_amount", "global_budget", "quiet_hours", "repeat_pause"]);
    const journal = (await alice.in(ws).get("/api/activity")).json();
    expect(journal.map((e: { message: string }) => e.message)).toEqual(["Workspace “Initech” created."]);
  });

  it("puts agents created from the dashboard in the current workspace", async () => {
    const { db, alice } = await setup();
    const ws = (await alice.send("POST", "/api/workspaces", { name: "Initech" })).json().id;
    const created = await alice.in(ws).send("POST", "/api/agents", { name: "Invoice reader" });
    expect(created.statusCode).toBe(201);
    expect(get(db, "SELECT workspace_id FROM agents WHERE id = ?", created.json().id)).toEqual({ workspace_id: ws });
    expect((await alice.get("/api/agents")).json()).toEqual([]);
  });
});

describe("roles", () => {
  it("lets a viewer watch, decide and report, but not operate", async () => {
    const { app, db, alice } = await setup();
    addAgent(db, "bot", "main");
    run(db, "INSERT INTO approvals (agent_id, action, title, reason, created_at) VALUES ('bot', 'stripe.refund', 'Refund $900', 'over limit', ?)", NOW);
    const { person: vic } = await invite(app, alice, "vic@client.com", "viewer", "Vic");

    expect((await vic.get("/api/agents")).statusCode).toBe(200);
    expect((await vic.get("/api/agents/bot")).json().api_key).toBeNull();
    expect((await alice.get("/api/agents/bot")).json().api_key).toMatch(/^ahq_/);

    for (const res of await Promise.all([
      vic.send("POST", "/api/agents", { name: "New" }),
      vic.send("PATCH", "/api/agents/bot", { budget_cents: 1 }),
      vic.send("POST", "/api/agents/bot/actions/pause"),
      vic.send("POST", "/api/agents/bot/rotate-key"),
      vic.send("PATCH", "/api/rules/refunds", { enabled: false }),
      vic.send("POST", "/api/workspace/invites", { email: "x@client.com", role: "owner" }),
    ])) expect(res.statusCode).toBe(403);

    expect((await vic.send("POST", "/api/approvals/1/decision", { approve: false })).statusCode).toBe(200);
    expect((await vic.send("POST", "/api/agents/bot/reports", { description: "Wrong customer name" })).statusCode).toBe(201);
    expect(get(db, "SELECT decided_by FROM approvals")).toEqual({ decided_by: "Vic" });
  });

  it("lets a member operate but not manage people", async () => {
    const { app, db, alice } = await setup();
    addAgent(db, "bot", "main");
    const { person: max, me } = await invite(app, alice, "max@client.com", "member", "Max");
    expect((await max.send("POST", "/api/agents/bot/actions/pause")).statusCode).toBe(200);
    expect((await max.send("POST", "/api/workspace/invites", { email: "x@client.com", role: "member" })).statusCode).toBe(403);
    expect((await max.send("PATCH", `/api/workspace/members/${me.user.id}`, { role: "owner" })).statusCode).toBe(403);
    // Anyone can leave a workspace.
    expect((await max.send("DELETE", `/api/workspace/members/${me.user.id}`)).statusCode).toBe(200);
    expect((await max.get("/api/agents")).statusCode).toBe(403);
  });

  it("always keeps at least one owner", async () => {
    const { alice } = await setup();
    const aliceId = (await alice.get("/api/me")).json().user.id;
    expect((await alice.send("PATCH", `/api/workspace/members/${aliceId}`, { role: "member" })).statusCode).toBe(409);
    expect((await alice.send("DELETE", `/api/workspace/members/${aliceId}`)).statusCode).toBe(409);
  });
});

describe("platform administrator", () => {
  it("sees every workspace and can hand out a password reset link", async () => {
    const { app, alice } = await setup();
    const ws = (await alice.send("POST", "/api/workspaces", { name: "Acme" })).json().id;
    const { person: bob } = await invite(app, alice.in(ws), "bob@acme.com", "owner", "Bob");

    expect((await bob.get("/api/admin/workspaces")).statusCode).toBe(403);
    expect((await bob.get("/api/early-access")).statusCode).toBe(403);
    const list = (await alice.get("/api/admin/workspaces")).json();
    expect(list.map((w: { name: string; owners: string }) => `${w.name}: ${w.owners}`)).toEqual(["Main workspace: alice@agency.io", "Acme: alice@agency.io, bob@acme.com"]);

    const link = (await alice.send("POST", "/api/admin/reset-link", { email: "bob@acme.com" })).json().link;
    const token = link.split("/#/link/")[1];
    expect((await app.inject({ url: `/api/auth/link/${token}` })).json()).toMatchObject({ kind: "reset", email: "bob@acme.com" });
    expect((await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: { password: "a brand new password" } })).statusCode).toBe(200);

    // Old sessions are closed and only the new password works.
    expect((await bob.get("/api/me")).statusCode).toBe(401);
    const login = (password: string) => app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "bob@acme.com", password } });
    expect((await login(PASSWORD)).statusCode).toBe(401);
    expect((await login("a brand new password")).statusCode).toBe(200);
  });

  it("lets anyone change their own password", async () => {
    const { app, alice } = await setup();
    expect((await alice.send("POST", "/api/me/password", { current: "wrong one!", next: "another long password" })).statusCode).toBe(401);
    expect((await alice.send("POST", "/api/me/password", { current: PASSWORD, next: "short" })).statusCode).toBe(400);
    expect((await alice.send("POST", "/api/me/password", { current: PASSWORD, next: "another long password" })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "alice@agency.io", password: "another long password" } })).statusCode).toBe(200);
  });
});

describe("without accounts (local trial)", () => {
  it("opens everything to whoever runs the server", async () => {
    const app = buildApp({ db: openDb(":memory:"), now: () => NOW });
    expect((await app.inject({ url: "/api/auth/state" })).json()).toEqual({ mode: "open", setup_needed: false, signup: false, google: false });
    const me = (await app.inject({ url: "/api/me", headers: { "x-user-name": "Sam" } })).json();
    expect(me).toMatchObject({ mode: "open", user: { name: "Sam", is_admin: true }, workspaces: [{ id: "main" }] });
    expect((await app.inject({ url: "/api/overview" })).statusCode).toBe(200);
  });
});

describe("self sign-up", () => {
  const visitor = { name: "Dana Brooks", company: "Brightline", email: "Dana@Brightline.co", password: PASSWORD };

  async function openServer() {
    const db = openDb(":memory:");
    const app = buildApp({ db, adminToken: CODE, now: () => NOW, signup: true });
    expect((await app.inject({ url: "/api/auth/state" })).json().signup).toBe(false);
    const admin = await app.inject({ method: "POST", url: "/api/auth/setup", payload: { setup_code: CODE, name: "Alice", email: "alice@agency.io", password: PASSWORD } });
    return { app, db, alice: browser(app, cookieOf(admin)) };
  }

  it("gives a new person their own empty workspace, as its owner", async () => {
    const { app, db, alice } = await openServer();
    addAgent(db, "demo-bot", "main");
    expect((await app.inject({ url: "/api/auth/state" })).json().signup).toBe(true);

    const res = await app.inject({ method: "POST", url: "/api/auth/signup", payload: visitor });
    expect(res.statusCode).toBe(201);
    const me = res.json();
    expect(me).toMatchObject({ user: { name: "Dana Brooks", email: "dana@brightline.co", is_admin: false }, workspaces: [{ name: "Brightline", role: "owner" }] });

    const dana = browser(app, cookieOf(res), me.workspaces[0].id);
    expect((await dana.get("/api/agents")).json()).toEqual([]);
    expect((await dana.get("/api/rules")).json()).toHaveLength(4);
    expect((await dana.in("main").get("/api/agents")).statusCode).toBe(403);
    expect((await dana.get("/api/admin/workspaces")).statusCode).toBe(403);
    // The administrator sees the new client in the list.
    expect((await alice.get("/api/admin/workspaces")).json().map((w: { name: string }) => w.name)).toContain("Brightline");
  });

  it("refuses a second account with the same email, a short password, and before the first account exists", async () => {
    const before = buildApp({ db: openDb(":memory:"), adminToken: CODE, now: () => NOW, signup: true });
    expect((await before.inject({ method: "POST", url: "/api/auth/signup", payload: visitor })).statusCode).toBe(403);

    const { app } = await openServer();
    expect((await app.inject({ method: "POST", url: "/api/auth/signup", payload: { ...visitor, password: "short" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/auth/signup", payload: visitor })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/auth/signup", payload: { ...visitor, email: "dana@brightline.co" } })).statusCode).toBe(409);
  });

  it("can be closed, ignores bots and limits sign-ups per visitor", async () => {
    const closed = buildApp({ db: openDb(":memory:"), adminToken: CODE, now: () => NOW });
    await closed.inject({ method: "POST", url: "/api/auth/setup", payload: { setup_code: CODE, name: "Alice", email: "alice@agency.io", password: PASSWORD } });
    expect((await closed.inject({ url: "/api/auth/state" })).json().signup).toBe(false);
    expect((await closed.inject({ method: "POST", url: "/api/auth/signup", payload: visitor })).statusCode).toBe(403);

    const { app, db } = await openServer();
    expect((await app.inject({ method: "POST", url: "/api/auth/signup", payload: { ...visitor, website: "http://spam.example" } })).statusCode).toBe(201);
    expect(get(db, "SELECT COUNT(*) n FROM users")).toEqual({ n: 1 });

    const from = (i: number, ip = "203.0.113.7") =>
      app.inject({ method: "POST", url: "/api/auth/signup", remoteAddress: ip, payload: { ...visitor, email: `p${i}@example.com` } });
    for (let i = 0; i < 5; i++) expect((await from(i)).statusCode).toBe(201);
    expect((await from(5)).statusCode).toBe(429);
    expect((await from(6, "198.51.100.4")).statusCode).toBe(201);
  });
});

describe("continue with Google", () => {
  const google = { clientId: "client-123.apps.googleusercontent.com", clientSecret: "secret-xyz" };

  /** Stands in for Google: any code becomes this profile. */
  function fakeGoogle(profile: { email: string; email_verified: boolean; name?: string }) {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
        const body = new URLSearchParams(String(init?.body));
        if (body.get("client_secret") !== google.clientSecret || body.get("code") !== "good-code") return new Response("{}", { status: 400 });
        return Response.json({ access_token: "at-1" });
      }
      if (String(url).startsWith("https://openidconnect.googleapis.com/v1/userinfo")) return Response.json(profile);
      return new Response("", { status: 404 });
    }) as typeof fetch;
    return { fetchImpl, calls };
  }

  async function server(profile: { email: string; email_verified: boolean; name?: string }, signup = true) {
    const db = openDb(":memory:");
    const { fetchImpl, calls } = fakeGoogle(profile);
    const app = buildApp({ db, adminToken: CODE, now: () => NOW, signup, google, fetchImpl });
    await app.inject({ method: "POST", url: "/api/auth/setup", payload: { setup_code: CODE, name: "Alice", email: "alice@agency.io", password: PASSWORD } });
    return { app, db, calls };
  }

  /** Clicks "Continue with Google", then comes back from Google with `code`. */
  async function roundTrip(app: App, code = "good-code") {
    const start = await app.inject({ url: "/api/auth/google/start" });
    expect(start.statusCode).toBe(302);
    const to = new URL(String(start.headers.location));
    expect(to.origin + to.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(to.searchParams.get("client_id")).toBe(google.clientId);
    expect(to.searchParams.get("redirect_uri")).toBe("http://localhost:80/api/auth/google/callback");
    const state = to.searchParams.get("state")!;
    const back = await app.inject({ url: `/api/auth/google/callback?code=${code}&state=${state}`, headers: { cookie: cookieOf(start) } });
    const cookies = ([] as string[]).concat(back.headers["set-cookie"] as string | string[] ?? []);
    const session = cookies.find((c) => c.startsWith("orvanta_session="))?.split(";")[0] ?? "";
    return { back, session };
  }

  it("signs up a new person with their Google account and opens their own workspace", async () => {
    const { app, db } = await server({ email: "Sam@Gmail.com", email_verified: true, name: "Sam Rivera" });
    expect((await app.inject({ url: "/api/auth/state" })).json().google).toBe(true);
    const { back, session } = await roundTrip(app);
    expect(back.headers.location).toBe("/#/brief");
    const me = (await app.inject({ url: "/api/me", headers: { cookie: session } })).json();
    expect(me).toMatchObject({ user: { name: "Sam Rivera", email: "sam@gmail.com", is_admin: false, has_password: false }, workspaces: [{ name: "Sam Rivera's workspace", role: "owner" }] });
    // No password was set: the password form can't be used to get in.
    expect(get(db, "SELECT password_hash FROM users WHERE email = 'sam@gmail.com'")).toEqual({ password_hash: "" });
    expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "sam@gmail.com", password: "" } })).statusCode).toBe(400);
  });

  it("signs in an existing account, even when sign-up is closed", async () => {
    const { app } = await server({ email: "alice@agency.io", email_verified: true }, false);
    const { back, session } = await roundTrip(app);
    expect(back.headers.location).toBe("/#/brief");
    expect((await app.inject({ url: "/api/me", headers: { cookie: session } })).json().user).toMatchObject({ name: "Alice", is_admin: true, has_password: true });
  });

  it("refuses unknown people when sign-up is closed, unverified emails, and forged or replayed answers", async () => {
    const closed = await server({ email: "new@gmail.com", email_verified: true }, false);
    expect((await roundTrip(closed.app)).back.headers.location).toBe("/#/auth-error/no-account");

    const unverified = await server({ email: "x@gmail.com", email_verified: false });
    expect((await roundTrip(unverified.app)).back.headers.location).toBe("/#/auth-error/unverified");

    const { app, db } = await server({ email: "y@gmail.com", email_verified: true });
    expect((await roundTrip(app, "bad-code")).back.headers.location).toBe("/#/auth-error/google");
    // No state cookie (another browser started it): refused before Google is even asked.
    const forged = await app.inject({ url: "/api/auth/google/callback?code=good-code&state=abc" });
    expect(forged.headers.location).toBe("/#/auth-error/expired");
    expect(get(db, "SELECT COUNT(*) n FROM users")).toEqual({ n: 1 });
  });

  it("takes an account back from someone who signed up with an email they don't own", async () => {
    const { app, db } = await server({ email: "boss@acme.com", email_verified: true, name: "Real Boss" });
    const squatter = await app.inject({ method: "POST", url: "/api/auth/signup", payload: { name: "Squatter", email: "boss@acme.com", password: PASSWORD } });
    expect(squatter.statusCode).toBe(201);
    const squatterCookie = cookieOf(squatter);

    const { session } = await roundTrip(app);
    expect((await app.inject({ url: "/api/me", headers: { cookie: session } })).statusCode).toBe(200);
    // The squatter's session and password no longer work.
    expect((await app.inject({ url: "/api/me", headers: { cookie: squatterCookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "boss@acme.com", password: PASSWORD } })).statusCode).toBe(401);
    expect(get(db, "SELECT email_verified FROM users WHERE email = 'boss@acme.com'")).toEqual({ email_verified: 1 });
  });

  it("lets a person signed in with Google accept an invitation in one click", async () => {
    const { app, db } = await server({ email: "sam@gmail.com", email_verified: true, name: "Sam" });
    const { session } = await roundTrip(app);
    const admin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "alice@agency.io", password: PASSWORD } });
    const alice = browser(app, cookieOf(admin));
    const link = (await alice.send("POST", "/api/workspace/invites", { email: "sam@gmail.com", role: "viewer" })).json().link;
    const token = link.split("/#/link/")[1];

    expect((await app.inject({ url: `/api/auth/link/${token}` })).json().signed_in).toBe(false);
    expect((await app.inject({ url: `/api/auth/link/${token}`, headers: { cookie: session } })).json()).toMatchObject({ account_exists: true, signed_in: true });
    // Without the session, an empty password is refused.
    expect((await app.inject({ method: "POST", url: `/api/auth/link/${token}`, payload: {} })).statusCode).toBe(401);
    const joined = await app.inject({ method: "POST", url: `/api/auth/link/${token}`, headers: { cookie: session }, payload: {} });
    expect(joined.statusCode).toBe(200);
    expect(joined.json().workspaces.map((w: { role: string }) => w.role).sort()).toEqual(["owner", "viewer"]);
    expect(get(db, "SELECT COUNT(*) n FROM memberships WHERE role = 'viewer'")).toEqual({ n: 1 });
  });

  it("sends visitors to the sign-up page when Google isn't set up", async () => {
    const app = buildApp({ db: openDb(":memory:"), adminToken: CODE, now: () => NOW, signup: true });
    expect((await app.inject({ url: "/api/auth/state" })).json().google).toBe(false);
    expect((await app.inject({ url: "/api/auth/google/start" })).headers.location).toBe("/#/signup");
  });
});
