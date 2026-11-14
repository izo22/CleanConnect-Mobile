/**
 * Silence: a workflow whose trigger stops (a disconnected app, an expired
 * connection, a schedule turned off) raises no error. It just goes quiet.
 *
 * Orvanta learns when each agent is usually active, from its events and its
 * permission checks over the last four weeks, and opens an alert when it has
 * been quiet for longer than its habits allow:
 *
 * - by the hour: for each hour of the day, on weekdays and on weekends, how
 *   often the agent was active then. Hours it is almost always active add up
 *   as evidence while it stays quiet; nights and weekends it never works add
 *   nothing. The alert opens once the silence would happen less than once in
 *   a thousand times if all were well (about 3 missed busy hours).
 * - by the gap: a job that runs once a day, a little earlier or later each
 *   time, has no reliable hour. It is flagged once the silence is half as
 *   long again as the longest gap it ever had.
 *
 * Each agent can also be set to a fixed number of hours, or have the alert
 * turned off (`silence_hours`: NULL = learned, 0 = off, N = after N hours).
 */
import { all, get, type DB } from "./db.ts";
import { hourLabel, locale, many, timezone, tr } from "./i18n.ts";
import { DAY, HOUR, type AgentRow } from "./model.ts";

export const LEARN_DAYS = 28;
export const MIN_HISTORY_DAYS = 7;
const MIN_ACTIVE_HOURS = 5;
/** -ln(1/1000): the silence must be that unlikely, given the agent's habits. */
const EVIDENCE = Math.log(1000);
/** An hour counts as "usually active" from this share, when describing the rhythm. */
const USUAL = 0.7;
const SLOTS = 48;

/** Weekday hours are slots 0-23, weekend hours 24-47, in the server's time zone. */
const slotCache = new Map<string, number>();
export function slotOf(hour: number): number {
  const tz = timezone();
  const key = `${tz}:${hour}`;
  const hit = slotCache.get(key);
  if (hit !== undefined) return hit;
  if (slotCache.size > 50_000) slotCache.clear();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(hour * HOUR));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const slot = (wd === "Sat" || wd === "Sun" ? 24 : 0) + h;
  slotCache.set(key, slot);
  return slot;
}

/** Records that the agent asked permission during this hour (checks leave no event). */
export function notePulse(db: DB, agentId: string, now: number) {
  db.prepare("INSERT INTO check_hours (agent_id, hour) VALUES (?, ?) ON CONFLICT (agent_id, hour) DO UPDATE SET n = n + 1").run(agentId, Math.floor(now / HOUR));
}

/** The last time the agent did or asked anything. */
export function lastActivityAt(db: DB, agent: Pick<AgentRow, "id" | "last_check_at">): number | null {
  const ev = get<{ t: number | null }>(db, "SELECT MAX(ts) t FROM events WHERE agent_id = ?", agent.id)?.t ?? null;
  const ck = agent.last_check_at ?? null;
  return ev === null ? ck : ck === null ? ev : Math.max(ev, ck);
}

function firstActivityAt(db: DB, agentId: string): number | null {
  const ev = get<{ t: number | null }>(db, "SELECT MIN(ts) t FROM events WHERE agent_id = ?", agentId)?.t ?? null;
  const ck = get<{ h: number | null }>(db, "SELECT MIN(hour) h FROM check_hours WHERE agent_id = ?", agentId)?.h ?? null;
  const ckT = ck === null ? null : ck * HOUR;
  return ev === null ? ckT : ckT === null ? ev : Math.min(ev, ckT);
}

export interface Rhythm {
  /** Share of past occurrences of each slot in which the agent was active (shrunk toward 0 when seen rarely). */
  p: number[];
  act: number[];
  occ: number[];
  /** Longest stretch without activity in the learning window, in hours. */
  maxGap: number;
  /** Days of history it was learned from (7 to 28). */
  days: number;
}

/** The agent's habits, learned from the four weeks before its last activity. */
function learn(db: DB, agentId: string, firstHour: number, lastHour: number): Rhythm | null {
  if (lastHour - firstHour + 1 < MIN_HISTORY_DAYS * 24) return null;
  const start = Math.max(firstHour, lastHour - LEARN_DAYS * 24 + 1);
  const hours = all<{ h: number }>(
    db,
    `SELECT DISTINCT ts / ${HOUR} AS h FROM events WHERE agent_id = ? AND ts >= ? AND ts < ?
     UNION SELECT hour AS h FROM check_hours WHERE agent_id = ? AND hour >= ? AND hour <= ?
     ORDER BY h`,
    agentId, start * HOUR, (lastHour + 1) * HOUR, agentId, start, lastHour,
  ).map((r) => Number(r.h));
  if (hours.length < MIN_ACTIVE_HOURS) return null;
  const active = new Set(hours);
  const act = new Array<number>(SLOTS).fill(0);
  const occ = new Array<number>(SLOTS).fill(0);
  for (let h = start; h <= lastHour; h++) {
    const s = slotOf(h);
    occ[s]++;
    if (active.has(h)) act[s]++;
  }
  let maxGap = 0;
  for (let i = 1; i < hours.length; i++) maxGap = Math.max(maxGap, hours[i] - hours[i - 1]);
  return { p: act.map((a, s) => a / (occ[s] + 1)), act, occ, maxGap, days: Math.round((lastHour - start + 1) / 24) };
}

/** Learning is redone at most once per new hour of activity. */
const cache = new WeakMap<DB, Map<string, { key: string; rhythm: Rhythm | null }>>();
function rhythmOf(db: DB, agentId: string, first: number, last: number): Rhythm | null {
  const firstHour = Math.floor(first / HOUR);
  const lastHour = Math.floor(last / HOUR);
  const key = `${timezone()}:${firstHour}:${lastHour}`;
  let byAgent = cache.get(db);
  if (!byAgent) cache.set(db, (byAgent = new Map()));
  const hit = byAgent.get(agentId);
  if (hit?.key === key) return hit.rhythm;
  const rhythm = learn(db, agentId, firstHour, lastHour);
  byAgent.set(agentId, { key, rhythm });
  return rhythm;
}

export interface Silence {
  /** Hours since the last activity. */
  hours: number;
  last: number;
  /** Why it is unusual, in words. */
  reason: string;
}

const hoursText = (h: number) => {
  if (h >= 48) {
    const d = Math.floor(h / 24);
    return tr(`${d} day${d === 1 ? "" : "s"}`, `${d} jour${many(d) ? "s" : ""}`);
  }
  const n = Math.max(1, Math.floor(h));
  return tr(`${n} hour${n === 1 ? "" : "s"}`, `${n} heure${many(n) ? "s" : ""}`);
};

const whenText = (t: number) => {
  const d = new Date(t);
  const day = d.toLocaleDateString(locale(), { weekday: "long", timeZone: timezone() });
  const time = d.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit", timeZone: timezone() });
  return tr(`${day} at ${time}`, `${day} à ${time}`);
};

/** Is the agent unusually quiet right now? null when it is not, or when there is nothing to judge yet. */
export function quietNow(db: DB, agent: AgentRow, now: number): Silence | null {
  if (agent.paused || agent.silence_hours === 0) return null;
  const last = lastActivityAt(db, agent);
  if (last === null || last >= now) return null;
  // The person said this silence was expected: wait for the agent to be active again.
  if (agent.silence_ack !== null && agent.silence_ack >= last) return null;
  const hours = (now - last) / HOUR;

  if (agent.silence_hours !== null) {
    if (hours < agent.silence_hours) return null;
    return {
      hours, last,
      reason: tr(
        `you asked to be alerted after ${hoursText(agent.silence_hours)} without activity`,
        `vous avez demandé une alerte après ${hoursText(agent.silence_hours)} sans activité`,
      ),
    };
  }

  if (hours < 2) return null;
  const first = firstActivityAt(db, agent.id);
  if (first === null) return null;
  const r = rhythmOf(db, agent.id, first, last);
  if (!r) return null;

  // By the hour: every complete hour of silence in which it is usually active.
  const lastHour = Math.floor(last / HOUR);
  const nowHour = Math.floor(now / HOUR);
  let evidence = 0;
  let missed = -1;
  for (let h = lastHour + 1; h < nowHour && evidence < EVIDENCE; h++) {
    const s = slotOf(h);
    if (r.p[s] <= 0) continue;
    evidence += -Math.log(1 - r.p[s]);
    if (missed < 0 || r.p[s] > r.p[missed]) missed = s;
  }
  if (evidence >= EVIDENCE && missed >= 0) {
    const days = missed < 24 ? tr("weekdays", "jours de semaine") : tr("weekend days", "jours de week-end");
    return {
      hours, last,
      reason: tr(
        `it is usually active at this time (${r.act[missed]} of the last ${r.occ[missed]} ${days})`,
        `il est d'habitude actif à cette heure-ci (${r.act[missed]} des ${r.occ[missed]} derniers ${days})`,
      ),
    };
  }

  // By the gap: half as long again as its longest silence, and at least 3 hours more.
  const limit = Math.max(r.maxGap * 1.5, r.maxGap + 3);
  if (hours >= limit) {
    return {
      hours, last,
      reason: tr(
        `over the past ${r.days} days it never went more than ${hoursText(r.maxGap)} without activity`,
        `sur les ${r.days} derniers jours, il n'est jamais resté plus de ${hoursText(r.maxGap)} sans activité`,
      ),
    };
  }
  return null;
}

/** The alert written for a quiet agent. */
export function silenceFinding(s: Silence) {
  const que = /^[aeiouéèh]/i.test(s.reason) ? "qu'" : "que ";
  return {
    kind: "silence",
    severity: "warning" as const,
    title: tr(`Gone quiet: no activity for ${hoursText(s.hours)}`, `Silencieux : aucune activité depuis ${hoursText(s.hours)}`),
    cause: tr(
      `no error, but nothing at all since ${whenText(s.last)}, while ${s.reason}. Something upstream may have stopped it: a disconnected app, an expired connection, a trigger or a schedule turned off.`,
      `aucune erreur, mais plus rien depuis ${whenText(s.last)}, alors ${que}${s.reason}. Quelque chose en amont l'a peut-être arrêté : une application déconnectée, une connexion expirée, un déclencheur ou une planification désactivés.`,
    ),
    impact: tr(
      "Whatever it usually handles (leads, messages, posts…) may be waiting or lost.",
      "Ce qu'il traite d'habitude (prospects, messages, publications…) attend peut-être, ou se perd.",
    ),
    since: s.last,
  };
}

/** "8 am–6 pm", or "10 pm–2 am" across midnight, from a set of hours. */
function ranges(hours: number[]): string {
  const set = new Set(hours);
  const runs: Array<[number, number]> = [];
  for (let h = 0; h < 24; h++) {
    if (!set.has(h)) continue;
    if (runs.length && runs[runs.length - 1][1] === h - 1) runs[runs.length - 1][1] = h;
    else runs.push([h, h]);
  }
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === 23) {
    const [a] = runs.splice(0, 1);
    runs[runs.length - 1][1] = a[1] + 24;
  }
  return runs.map(([a, b]) => `${hourLabel(a % 24)}–${hourLabel((b + 1) % 24)}`).join(", ");
}

/** The rhythm in words, for the agent's page: the hours it was active at least 70% of the time. */
export function describeRhythm(r: Rhythm): string {
  const usual = (offset: number) => [...Array(24).keys()].filter((h) => r.occ[offset + h] >= 2 && r.act[offset + h] / r.occ[offset + h] >= USUAL);
  const weekday = usual(0);
  const weekend = usual(24);
  if (weekday.length === 24 && weekend.length === 24) return tr("around the clock", "jour et nuit, sans interruption");
  const when = (hours: number[]) => (hours.length === 24 ? tr("all day", "toute la journée") : ranges(hours));
  const parts = [
    weekday.length ? tr(`weekdays ${when(weekday)}`, `en semaine ${when(weekday)}`) : "",
    weekend.length ? tr(`weekends ${when(weekend)}`, `le week-end ${when(weekend)}`) : "",
  ].filter(Boolean);
  if (parts.length) return parts.join(tr("; ", " ; "));
  return tr(`never more than ${hoursText(r.maxGap)} without activity`, `jamais plus de ${hoursText(r.maxGap)} sans activité`);
}

/** What the agent's page shows about silence alerts. */
export function silenceView(db: DB, agent: AgentRow, now: number) {
  const setting: "auto" | "off" | number = agent.silence_hours === null ? "auto" : agent.silence_hours === 0 ? "off" : agent.silence_hours;
  const last = lastActivityAt(db, agent);
  const base = { setting, last_activity_at: last };
  if (setting === "off") return { ...base, state: "off" as const, rhythm: null, learning_days_left: null };
  if (last === null) return { ...base, state: "waiting" as const, rhythm: null, learning_days_left: null };
  const quiet = quietNow(db, agent, now) !== null;
  if (setting !== "auto") return { ...base, state: quiet ? ("quiet" as const) : ("watching" as const), rhythm: null, learning_days_left: null };
  const first = firstActivityAt(db, agent.id) ?? last;
  const r = rhythmOf(db, agent.id, first, last);
  if (!r) {
    const left = Math.max(1, Math.ceil(MIN_HISTORY_DAYS - (now - first) / DAY));
    return { ...base, state: "learning" as const, rhythm: null, learning_days_left: left };
  }
  return { ...base, state: quiet ? ("quiet" as const) : ("watching" as const), rhythm: describeRhythm(r), learning_days_left: null };
}
