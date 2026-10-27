import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { all, openDb } from "./db.ts";
import { check } from "./guard.ts";
import { hourLabel, money } from "./i18n.ts";
import { getAgent } from "./model.ts";
import { describeRule } from "./rules.ts";
import { seed } from "./seed.ts";

process.env.NODE_ENV = "test";

const NOW = Date.UTC(2026, 9, 26, 14, 0, 0);
const setLanguage = (language?: string, currency?: string) => {
  if (language) process.env.APP_LANGUAGE = language;
  else delete process.env.APP_LANGUAGE;
  if (currency) process.env.CURRENCY = currency;
  else delete process.env.CURRENCY;
};

afterEach(() => setLanguage());

describe("instance language", () => {
  it("is English with dollars by default, French with euros on request", () => {
    expect(money(34000)).toBe("$340");
    expect(money(1240000)).toBe("$12,400");
    expect(money(450)).toBe("$4.50");
    expect(hourLabel(22)).toBe("10 pm");
    expect(hourLabel(0)).toBe("12 am");
    expect(describeRule("quiet_hours", "customer email", { start_hour: 22, end_hour: 7 })).toBe("No customer email between 10 pm and 7 am");

    setLanguage("fr");
    expect(money(34000).replace(/\s/g, " ")).toBe("340 €");
    expect(hourLabel(22)).toBe("22 h");
    expect(describeRule("approval_amount", "remboursement", { max_cents: 20000 }).replace(/\s/g, " ")).toBe("Validation humaine pour tout remboursement au-dessus de 200 €");

    setLanguage("en", "EUR");
    expect(money(34000)).toBe("€340");
  });

  it("tells the interface which language and currency to use, before sign-in", async () => {
    const app = buildApp({ db: openDb(":memory:"), adminToken: "a-very-long-secret-123" });
    expect((await app.inject({ url: "/api/locale" })).json()).toEqual({ language: "en", currency: "USD" });
    setLanguage("fr");
    expect((await app.inject({ url: "/api/locale" })).json()).toEqual({ language: "fr", currency: "EUR" });
    expect((await app.inject({ url: "/api/overview" })).json()).toEqual({ error: "Code d'accès requis." });
  });
});

describe("demo workspace", () => {
  const alerts = (db: ReturnType<typeof openDb>) =>
    Object.fromEntries(all<{ kind: string; title: string }>(db, "SELECT kind, title FROM alerts WHERE status = 'open'").map((a) => [a.kind, a.title]));

  it("is a US company in English, with the same incidents detected", () => {
    const db = openDb(":memory:");
    seed(db, NOW);
    const open = alerts(db);
    expect(open.language).toBe("Answers in Spanish instead of English");
    expect(open.auth).toBe("Can no longer connect to HubSpot");
    expect(open.duplicates).toMatch(/^Repeated \d+ actions it had already done \(email sends\)$/);
    expect(open.human_report).toBe("Mistake reported by Marcus Johnson");
    expect(open.quality).toMatch(/reviewed answers contain mistakes$/);
    const refund = check(db, getAgent(db, "refunds")!, { action: "stripe.refund", amount_cents: 34000 }, NOW);
    expect(refund).toMatchObject({ decision: "needs_approval", reason: "Over $200: approval required." });
  });

  it("is a French company in French", () => {
    setLanguage("fr");
    const db = openDb(":memory:");
    seed(db, NOW);
    const open = alerts(db);
    expect(open.language).toBe("Répond en anglais au lieu du français");
    expect(open.auth).toBe("N'arrive plus à se connecter à HubSpot");
    expect(open.human_report).toBe("Erreur signalée par Karim Benali");
    const refund = check(db, getAgent(db, "remboursements")!, { action: "stripe.refund", amount_cents: 34000 }, NOW);
    expect(refund.decision).toBe("needs_approval");
    expect("reason" in refund && refund.reason.replace(/\s/g, " ")).toBe("Au-dessus de 200 € : validation requise.");
  });
});
