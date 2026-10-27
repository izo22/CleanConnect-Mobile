import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { openDb, run } from "./db.ts";
import { backupNow, dailyMaintenance, pruneBackups, purgeOldEvents } from "./maintenance.ts";
import { DAY, newApiKey } from "./model.ts";

process.env.NODE_ENV = "test";

const NOW = Date.UTC(2026, 9, 27, 10, 0, 0);

function filledDb(path: string) {
  const db = openDb(path);
  run(db, "INSERT INTO agents (id, name, api_key, created_at) VALUES ('a', 'Agent', ?, 0)", newApiKey());
  for (let i = 0; i < 50; i++) run(db, "INSERT INTO events (agent_id, ts, kind) VALUES ('a', ?, 'task')", NOW - i * 3 * DAY);
  return db;
}

describe("backups", () => {
  it("produce a database that can be restored with all the data", () => {
    const dir = mkdtempSync(join(tmpdir(), "hq-"));
    const db = filledDb(join(dir, "live.db"));
    const file = backupNow(db, join(dir, "backups"), NOW);
    expect(file.endsWith("agent-hq-2026-10-27.db")).toBe(true);

    const restored = openDb(file);
    expect((restored.prepare("SELECT COUNT(*) n FROM events").get() as { n: number }).n).toBe(50);
    expect((restored.prepare("SELECT name FROM agents").get() as { name: string }).name).toBe("Agent");
  });

  it("keep only the last N days and run once a day", () => {
    const dir = mkdtempSync(join(tmpdir(), "hq-"));
    const backups = join(dir, "backups");
    const db = filledDb(join(dir, "live.db"));
    backupNow(db, backups, NOW - 40 * DAY);
    writeFileSync(join(backups, "notes.txt"), "not a backup");

    const first = dailyMaintenance(db, { backupDir: backups, keepDays: 30, retentionDays: 90 }, NOW);
    expect(first.backup).not.toBeNull();
    expect(first.pruned).toEqual(["agent-hq-2026-09-17.db"]);
    expect(readdirSync(backups).sort()).toEqual(["agent-hq-2026-10-27.db", "notes.txt"]);

    const second = dailyMaintenance(db, { backupDir: backups, keepDays: 30, retentionDays: 90 }, NOW + 3_600_000);
    expect(second.backup).toBeNull();
    expect(pruneBackups(join(dir, "missing"), 30, NOW)).toEqual([]);
  });
});

describe("retention", () => {
  it("removes events older than the retention period only", () => {
    const db = filledDb(":memory:");
    expect(purgeOldEvents(db, 90, NOW)).toBe(19); // events 93 to 147 days old
    expect((db.prepare("SELECT COUNT(*) n FROM events").get() as { n: number }).n).toBe(31);
  });
});

describe("production hardening", () => {
  it("sends security headers and checks the database in /api/health", async () => {
    const app = buildApp({ db: openDb(":memory:") });
    const page = await app.inject({ url: "/api/health" });
    expect(page.json()).toEqual({ ok: true });
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    expect(page.headers["x-frame-options"]).toBe("DENY");
  });

  it("accepts the admin code only when it matches exactly", async () => {
    const app = buildApp({ db: openDb(":memory:"), adminToken: "a-very-long-secret-123" });
    expect((await app.inject({ url: "/api/overview", headers: { "x-admin-token": "a-very-long-secret-12" } })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/overview", headers: { "x-admin-token": "a-very-long-secret-123" } })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/overview?token=a-very-long-secret-123" })).statusCode).toBe(200);
    // same number of characters, more bytes: refused, not a server error
    expect((await app.inject({ url: `/api/overview?token=${encodeURIComponent("a-very-long-secret-12é")}` })).statusCode).toBe(401);
  });
});

describe("logs", () => {
  it("never contain the dashboard code passed in the address", async () => {
    const lines: string[] = [];
    const app = buildApp({ db: openDb(":memory:"), adminToken: "a-very-long-secret-123", logger: { stream: { write: (l) => void lines.push(l) } } });
    await app.inject({ url: "/api/overview?token=a-very-long-secret-123&x=1" });
    const logged = lines.join("");
    expect(logged).toContain("/api/overview?token=***&x=1");
    expect(logged).not.toContain("a-very-long-secret-123");
  });
});
