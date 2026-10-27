/**
 * "Request early access" form of the public site: requests are stored here
 * and listed in the dashboard. The form is open to anyone, so it is guarded
 * by a hidden honeypot field and a per-visitor rate limit.
 */
import { all, run, type DB } from "./db.ts";

export interface EarlyAccessIn {
  name: string;
  email: string;
  company?: string;
  tools?: string[];
  fleet?: string;
  message?: string;
  /** Hidden from people; bots fill it in. */
  website?: string;
}

export const EARLY_ACCESS_INPUT = {
  type: "object",
  required: ["name", "email"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    email: { type: "string", maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    company: { type: "string", maxLength: 120 },
    tools: { type: "array", maxItems: 8, items: { type: "string", maxLength: 30 } },
    fleet: { type: "string", maxLength: 30 },
    message: { type: "string", maxLength: 2000 },
    website: { type: "string", maxLength: 200 },
  },
} as const;

/** Lets each key (a visitor's IP) through at most `max` times per window. */
export function rateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
    const allowed = recent.length < max;
    if (allowed) recent.push(now);
    if (hits.size > 10_000) hits.clear(); // keeps memory bounded under a flood
    hits.set(key, recent);
    return allowed;
  };
}

export function saveEarlyAccess(db: DB, r: EarlyAccessIn, now: number) {
  run(
    db,
    "INSERT INTO early_access (name, email, company, tools, fleet, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    r.name.trim(), r.email.trim().toLowerCase(), r.company?.trim() ?? "", JSON.stringify(r.tools ?? []), r.fleet ?? "", r.message?.trim() ?? "", now,
  );
}

export function earlyAccessList(db: DB) {
  return all<{ id: number; name: string; email: string; company: string; tools: string; fleet: string; message: string; created_at: number }>(
    db,
    "SELECT * FROM early_access ORDER BY created_at DESC, id DESC LIMIT 500",
  ).map((r) => ({ ...r, tools: JSON.parse(r.tools) as string[] }));
}

export type EarlyAccessView = ReturnType<typeof earlyAccessList>[number];
