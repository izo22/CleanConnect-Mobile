/**
 * Daily housekeeping for a production instance: backups of the database
 * (kept BACKUP_KEEP_DAYS days) and removal of old events (RETENTION_DAYS),
 * as promised in the requirements (§ 6 and § 11.2).
 */
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { run, type DB } from "./db.ts";
import { DAY } from "./model.ts";

const day = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Consistent copy of the live database, safe while the server keeps writing. */
export function backupNow(db: DB, dir: string, now = Date.now()): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `agent-hq-${day(now)}.db`);
  rmSync(file, { force: true }); // VACUUM INTO refuses to overwrite
  db.prepare("VACUUM INTO ?").run(file);
  return file;
}

export function pruneBackups(dir: string, keepDays: number, now = Date.now()): string[] {
  let removed: string[] = [];
  try {
    removed = readdirSync(dir)
      .filter((f) => /^agent-hq-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .filter((f) => Date.parse(f.slice(9, 19)) < now - keepDays * DAY);
    for (const f of removed) rmSync(join(dir, f), { force: true });
  } catch {
    // no backup folder yet
  }
  return removed;
}

/** Events older than the retention period go; alerts, decisions and the journal stay. */
export function purgeOldEvents(db: DB, retentionDays: number, now = Date.now()): number {
  return Number(run(db, "DELETE FROM events WHERE ts < ?", now - retentionDays * DAY).changes);
}

export function hasBackupToday(dir: string, now = Date.now()): boolean {
  try {
    return statSync(join(dir, `agent-hq-${day(now)}.db`)).size > 0;
  } catch {
    return false;
  }
}

export interface MaintenanceOptions { backupDir: string; keepDays: number; retentionDays: number }

export function dailyMaintenance(db: DB, o: MaintenanceOptions, now = Date.now()) {
  const purged = purgeOldEvents(db, o.retentionDays, now);
  const backup = hasBackupToday(o.backupDir, now) ? null : backupNow(db, o.backupDir, now);
  const pruned = pruneBackups(o.backupDir, o.keepDays, now);
  return { purged, backup, pruned };
}
