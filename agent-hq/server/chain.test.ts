import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { get, openDb, run, type DB } from "./db.ts";
import { getAgent } from "./model.ts";

process.env.NODE_ENV = "test";

let db: DB;
let app: ReturnType<typeof buildApp>;
let posted: Array<{ url: string; body: Record<string, unknown> }>;

const agent = async (name: string) => (await app.inject({ method: "POST", url: "/api/agents", payload: { name } })).json().id as string;
const chain = (id: string, ids: string[]) => app.inject({ method: "PATCH", url: `/api/agents/${id}`, payload: { pause_chain: ids } });
const act = (id: string, action: string) => app.inject({ method: "POST", url: `/api/agents/${id}/actions/${action}`, payload: {} });
const paused = (id: string) => !!getAgent(db, id)!.paused;
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
  db = openDb(":memory:");
  posted = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    posted.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  app = buildApp({ db, fetchImpl });
});

describe("chain pause", () => {
  it("pauses the agents downstream, through the whole chain, and resumes them together", async () => {
    const [intake, writer, sender] = [await agent("Lead intake"), await agent("Quote writer"), await agent("Quote sender")];
    expect((await chain(intake, [writer])).statusCode).toBe(200);
    await chain(writer, [sender]);

    const res = await act(intake, "pause");
    expect(res.json().message).toContain("2 agents downstream paused too");
    expect([paused(intake), paused(writer), paused(sender)]).toEqual([true, true, true]);
    expect(getAgent(db, sender)).toMatchObject({ paused_by: intake, pause_reason: "paused with Lead intake" });

    const detail = (await app.inject({ method: "GET", url: `/api/agents/${writer}` })).json();
    expect(detail.paused_by).toEqual({ id: intake, name: "Lead intake" });
    expect(detail.pause_chain).toEqual([sender]);

    expect((await act(intake, "resume")).json().message).toContain("2 agents downstream resumed too");
    expect([paused(intake), paused(writer), paused(sender)]).toEqual([false, false, false]);
  });

  it("leaves alone an agent someone paused by hand, and survives a loop in the chain", async () => {
    const [a, b, c] = [await agent("A"), await agent("B"), await agent("C")];
    await chain(a, [b, c]);
    await chain(b, [a]); // a loop
    await act(c, "pause"); // paused by hand before

    await act(a, "pause");
    expect([paused(a), paused(b), paused(c)]).toEqual([true, true, true]);
    expect(getAgent(db, c)!.paused_by).toBeNull();

    await act(a, "resume");
    expect([paused(a), paused(b), paused(c)]).toEqual([false, false, true]);
  });

  it("follows automatic pauses too", async () => {
    const [up, down] = [await agent("Upstream"), await agent("Downstream")];
    await chain(up, [down]);
    await app.inject({ method: "PATCH", url: `/api/agents/${up}`, payload: { alert_sensitivity: "strict" } });
    const key = getAgent(db, up)!.api_key;
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: "POST", url: "/api/v1/events", headers: { authorization: `Bearer ${key}` }, payload: { kind: "error", action: "crm.update", error_message: "timeout" } });
    }
    expect(paused(up)).toBe(true);
    expect(paused(down)).toBe(true);
    // The downstream agent's own permission checks are refused.
    const check = await app.inject({ method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${getAgent(db, down)!.api_key}` }, payload: { action: "email.send" } });
    expect(check.json().decision).toBe("deny");
  });

  it("tells subscribed platforms about the agents it paused", async () => {
    const [up, down] = [await agent("Up"), await agent("Down")];
    await chain(up, [down]);
    const key = getAgent(db, down)!.api_key;
    await app.inject({ method: "POST", url: "/api/v1/hooks", headers: { authorization: `Bearer ${key}` }, payload: { event: "agent_state", target_url: "https://hooks.example.com/down" } });
    await act(up, "pause");
    await settle();
    expect(posted.find((p) => p.url === "https://hooks.example.com/down")?.body).toMatchObject({ paused: true });
  });

  it("only accepts agents of the same workspace, and drops the agent itself", async () => {
    const a = await agent("Solo");
    expect((await chain(a, ["nope"])).statusCode).toBe(400);
    run(db, "INSERT INTO workspaces (id, name, created_at) VALUES ('other', 'Other', 0)");
    run(db, "INSERT INTO agents (id, workspace_id, name, mission, owner_name, owner_email, platform, autonomy, budget_cents, access, api_key, created_at) VALUES ('x', 'other', 'X', '', '', '', '', 2, 0, '[]', 'ahq_x', 0)");
    expect((await chain(a, ["x"])).statusCode).toBe(400);
    expect((await chain(a, [a])).statusCode).toBe(200);
    expect(get<{ pause_chain: string }>(db, "SELECT pause_chain FROM agents WHERE id = ?", a)!.pause_chain).toBe("[]");
  });
});
