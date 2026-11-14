import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { all, get, openDb, run, type DB } from "./db.ts";
import { evaluateAll } from "./engine.ts";
import { DAY, HOUR, MINUTE, getAgent } from "./model.ts";

process.env.NODE_ENV = "test";
process.env.TIMEZONE = "UTC";

let db: DB;
let app: ReturnType<typeof buildApp>;
let clock = 0;

/** Monday 16 November 2026, midnight UTC. */
const MONDAY = Date.UTC(2026, 10, 16);
const at = (dayOffset: number, hour: number, minute = 0) => MONDAY + dayOffset * DAY + hour * HOUR + minute * MINUTE;
const isWeekend = (t: number) => [0, 6].includes(new Date(t).getUTCDay());

beforeEach(() => {
  db = openDb(":memory:");
  clock = MONDAY;
  app = buildApp({ db, now: () => clock, fetchImpl: (async () => new Response("{}")) as typeof fetch });
});

const agent = async (name: string) => (await app.inject({ method: "POST", url: "/api/agents", payload: { name } })).json().id as string;
const event = (id: string, ts: number) => run(db, "INSERT INTO events (agent_id, ts, kind, action, success) VALUES (?, ?, 'task', 'crm.update', 1)", id, ts);
const silence = (id: string) => get<{ id: number; title: string; cause: string; status: string; resolution: string | null }>(
  db, "SELECT id, title, cause, status, resolution FROM alerts WHERE agent_id = ? AND kind = 'silence' ORDER BY id DESC LIMIT 1", id,
);
/** Moves the clock and runs the periodic pass, as the server does every minute. */
const tick = (t: number) => {
  clock = t;
  evaluateAll(db, t);
};
const detail = async (id: string) => (await app.inject({ method: "GET", url: `/api/agents/${id}` })).json();

/** Busy on weekdays from 9 am to 6 pm (a few events an hour), quiet at night and on weekends. */
function officeHours(id: string, fromDay: number, toDay: number) {
  for (let d = fromDay; d < toDay; d++) {
    if (isWeekend(at(d, 12))) continue;
    for (let h = 9; h < 18; h++) for (const m of [5, 25, 45]) event(id, at(d, h, m));
  }
}

describe("silence alerts", () => {
  it("knows an office-hours workflow: quiet nights and weekends are fine, a silent Monday morning is not", async () => {
    const id = await agent("Lead follow-up");
    officeHours(id, -21, -2); // three weeks, until Friday 5:45 pm

    tick(at(-2, 23)); // Saturday night
    tick(at(0, 8, 30)); // Monday, before work
    expect(silence(id)).toBeUndefined();
    tick(at(0, 11, 30)); // two busy hours missed: could still be a slow start
    expect(silence(id)).toBeUndefined();

    tick(at(0, 12, 30)); // three busy hours missed
    const alert = silence(id)!;
    expect(alert.status).toBe("open");
    expect(alert.title).toBe("Gone quiet: no activity for 2 days");
    expect(alert.cause).toContain("it is usually active at this time (15 of the last 15 weekdays)");
    expect(alert.cause).toContain("Friday at 5:45 PM");

    // The page shows what was learned, and the agent needs a look.
    const page = await detail(id);
    expect(page.silence).toMatchObject({ setting: "auto", state: "quiet", rhythm: "weekdays 9 am–6 pm" });
    expect(page.status).toBe("attention");
    expect(page.alerts[0].actions.map((a: { id: string }) => a.id)).toEqual(["notify_owner", "expected"]);

    // It starts again: the alert closes on its own.
    event(id, at(0, 12, 40));
    tick(at(0, 12, 41));
    expect(silence(id)).toMatchObject({ status: "resolved", resolution: "Activity resumed." });
  });

  it("follows a daily job that runs a little earlier or later each day", async () => {
    const id = await agent("Daily report");
    for (let d = -14; d < 0; d++) event(id, at(d, d % 2 ? 9 : 10, 15));
    // Last run: yesterday at 9:15 (day -1 is odd). Missing today's run is noticed in the evening.
    tick(at(0, 12));
    tick(at(0, 20));
    expect(silence(id)).toBeUndefined();
    tick(at(1, 0));
    expect(silence(id)?.status).toBe("open");
    expect(silence(id)!.cause).toContain("over the past 13 days it never went more than 25 hours without activity");
    expect((await detail(id)).silence.rhythm).toBe("never more than 25 hours without activity");
  });

  it("flags an around-the-clock agent within a few hours", async () => {
    const id = await agent("Order sync");
    for (let t = at(-10, 0); t < at(0, 6); t += 20 * MINUTE) event(id, t);
    tick(at(0, 9, 10)); // 3 complete hours missed, after 10 days of history
    expect(silence(id)).toBeUndefined();
    tick(at(0, 10, 10)); // 4
    expect(silence(id)?.status).toBe("open");
    expect((await detail(id)).silence.rhythm).toBe("around the clock");
  });

  it("learns for a week before judging, and stays quiet about agents that never reported", async () => {
    const fresh = await agent("New workflow");
    for (let d = -3; d < 0; d++) for (let h = 0; h < 24; h++) event(fresh, at(d, h));
    const never = await agent("Not wired yet");
    tick(at(2, 0));
    expect(silence(fresh)).toBeUndefined();
    expect(silence(never)).toBeUndefined();
    expect((await detail(fresh)).silence).toMatchObject({ state: "learning", learning_days_left: 2 });
    expect((await detail(never)).silence).toMatchObject({ state: "waiting" });
  });

  it("counts permission checks as activity, for agents that only ask before acting", async () => {
    const id = await agent("Publisher");
    const key = getAgent(db, id)!.api_key;
    for (let d = -10; d < 0; d++) {
      for (const h of [9, 13, 17]) {
        clock = at(d, h, 2);
        const res = await app.inject({ method: "POST", url: "/api/v1/check", headers: { authorization: `Bearer ${key}` }, payload: { action: "wordpress.publish" } });
        expect(res.statusCode).toBe(200);
      }
    }
    expect(all(db, "SELECT * FROM check_hours WHERE agent_id = ?", id)).toHaveLength(30);
    expect(get(db, "SELECT COUNT(*) n FROM events WHERE agent_id = ?", id)).toEqual({ n: 0 });
    tick(at(0, 12));
    expect(silence(id)).toBeUndefined();
    tick(at(1, 0));
    expect(silence(id)?.status).toBe("open");
    expect((await detail(id)).silence.rhythm).toBe("weekdays 9 am–10 am, 1 pm–2 pm, 5 pm–6 pm; weekends 9 am–10 am, 1 pm–2 pm, 5 pm–6 pm");
  });

  it("can use a fixed delay, be turned off, or be told a silence is expected", async () => {
    const id = await agent("Invoices");
    event(id, at(0, 9));
    const patch = (silence_hours: number | null) => app.inject({ method: "PATCH", url: `/api/agents/${id}`, payload: { silence_hours } });
    expect((await patch(-1)).statusCode).toBe(400);
    expect((await patch(5)).json().silence).toMatchObject({ setting: 5 });

    tick(at(0, 13));
    expect(silence(id)).toBeUndefined();
    tick(at(0, 14, 1));
    expect(silence(id)).toMatchObject({ status: "open" });
    expect(silence(id)!.cause).toContain("you asked to be alerted after 5 hours without activity");

    // "This silence is expected": closed, and not reopened until it is active again.
    const alertId = silence(id)!.id;
    const res = await app.inject({ method: "POST", url: `/api/alerts/${alertId}/actions/expected`, payload: {} });
    expect(res.statusCode).toBe(200);
    tick(at(1, 9));
    expect(silence(id)).toMatchObject({ id: alertId, status: "resolved" });
    event(id, at(1, 10));
    tick(at(1, 16));
    expect(silence(id)).toMatchObject({ status: "open" });
    expect(silence(id)!.id).not.toBe(alertId);

    // Turned off: the open alert closes and no new one comes.
    await patch(0);
    tick(at(3, 0));
    expect(silence(id)).toMatchObject({ status: "resolved", resolution: "Silence alerts turned off for this agent." });
    expect((await detail(id)).silence.state).toBe("off");
    await patch(null);
    expect((await detail(id)).silence.setting).toBe("auto");
  });

  it("does not flag a paused agent", async () => {
    const id = await agent("Campaign sender");
    officeHours(id, -21, 0);
    run(db, "UPDATE agents SET paused = 1, pause_reason = 'by Isaac' WHERE id = ?", id);
    tick(at(3, 16));
    expect(silence(id)).toBeUndefined();
  });
});
