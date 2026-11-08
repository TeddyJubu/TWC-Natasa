import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "./db";
import { importLovable } from "./import-lovable";

vi.mock("./email", async (orig) => ({ ...(await orig<object>()), sendEmail: async () => ({ sent: true }) }));
import { createAuth } from "./auth.server";

const fixture = () => JSON.parse(readFileSync("scripts/fixtures/lovable-export.json", "utf8"));
const [NATASA, ROSA, PIA] = ["1", "2", "3"].map((d) => `${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`);
const all = (db: DB, sql: string, ...args: string[]) => db.prepare(sql).all(...args);
const one = (db: DB, sql: string, ...args: string[]) => db.prepare(sql).get(...args);

describe("importLovable", () => {
  it("imports users, accounts and every table in one go and reports the counts", () => {
    const db = openDb(":memory:");
    expect(importLovable(db, fixture())).toEqual({
      users: 3, credentialAccounts: 2, googleAccounts: 1, profiles: 3, user_roles: 3, neighborhoods: 0,
      events: 1, event_rsvps: 1, headshot_bookings: 1, applications: 1,
    });
  });

  it("keeps ids, emails, created_at and email confirmation", () => {
    const db = openDb(":memory:");
    importLovable(db, fixture());
    expect(all(db, `select id, name, email, emailVerified, createdAt from "user" order by email`)).toEqual([
      { id: NATASA, name: "Natasa Admin", email: "natasa@x.test", emailVerified: 1, createdAt: "2026-01-01T09:00:00.000Z" },
      { id: PIA, name: "", email: "pia@x.test", emailVerified: 0, createdAt: "2026-03-01T08:00:00.000Z" },
      { id: ROSA, name: "Rosa Diaz", email: "rosa@x.test", emailVerified: 1, createdAt: "2026-02-01T08:00:00.000Z" },
    ]);
  });

  it("turns bcrypt passwords into credential accounts and google identities into google accounts", () => {
    const db = openDb(":memory:");
    importLovable(db, fixture());
    expect(all(db, "select userId, providerId, accountId, substr(password, 1, 2) as pw from account order by providerId, userId")).toEqual([
      { userId: NATASA, providerId: "credential", accountId: NATASA, pw: "$2" },
      { userId: PIA, providerId: "credential", accountId: PIA, pw: "$2" },
      { userId: ROSA, providerId: "google", accountId: "104857600000000000001", pw: null },
    ]);
  });

  it("keeps profiles (admin-only fields included) and roles exactly, clearing values the new schema can't hold", () => {
    const db = openDb(":memory:");
    importLovable(db, fixture());
    expect(one(db, "select status, catalogue_number as n, member_since as since, directory_visible as dv, avatar_path as a from profiles where id = ?", NATASA))
      .toEqual({ status: "approved", n: 11, since: "2026-01-03T00:00:00.000Z", dv: 1, a: `${NATASA}/avatar-1.jpg` });
    // An unknown neighborhood and a portrait outside her own folder become null rather than failing the import.
    expect(one(db, "select neighborhood, avatar_path from profiles where id = ?", ROSA)).toEqual({ neighborhood: null, avatar_path: null });
    expect(all(db, "select user_id, role from user_roles order by user_id, role")).toEqual([
      { user_id: NATASA, role: "admin" }, { user_id: NATASA, role: "member" }, { user_id: ROSA, role: "member" }, { user_id: PIA, role: "member" },
    ].sort((a, b) => a.user_id.localeCompare(b.user_id) || a.role.localeCompare(b.role)));
  });

  it("replaces the seeded events with the exported ones and keeps RSVPs, bookings and reviewed applications", () => {
    const db = openDb(":memory:");
    importLovable(db, fixture());
    expect(all(db, "select title, starts_at from events")).toEqual([{ title: "Spring Supper", starts_at: "2027-04-01T23:00:00.000Z" }]);
    expect(one(db, "select status from headshot_bookings")).toEqual({ status: "confirmed" });
    expect(one(db, "select user_id, status, reviewed_by, answers from applications"))
      .toEqual({ user_id: PIA, status: "approved", reviewed_by: NATASA, answers: '{"phone":"718-555-0100"}' });
  });

  it("gives a pending profile its linked application's outcome (the 0003 backfill) and continues the catalogue numbers", () => {
    const db = openDb(":memory:");
    importLovable(db, fixture());
    expect(one(db, "select status, catalogue_number as n from profiles where id = ?", PIA)).toEqual({ status: "approved", n: 15 });
  });

  it("refuses a database that already has accounts or applications, changing nothing", () => {
    const db = openDb(":memory:");
    importLovable(db, fixture());
    expect(() => importLovable(db, fixture())).toThrow(/not empty/);
    const fresh = openDb(":memory:");
    fresh.prepare("insert into applications (email, full_name) values ('a@x.test', 'A')").run();
    expect(() => importLovable(fresh, fixture())).toThrow(/not empty/);
  });

  it("rolls everything back when one row is bad", () => {
    const db = openDb(":memory:");
    const data = fixture();
    data.headshot_bookings[0].status = "maybe";
    expect(() => importLovable(db, data)).toThrow();
    expect(one(db, `select count(*) as n from "user"`)).toEqual({ n: 0 });
  });

  it("imported bcrypt users sign in with their old password", async () => {
    vi.stubEnv("APP_URL", "https://club.test");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret");
    const db = openDb(":memory:");
    importLovable(db, fixture());
    const res = await createAuth(db).api.signInEmail({ body: { email: "natasa@x.test", password: "legacy-password-1" }, asResponse: true });
    expect(res.status).toBe(200);
    vi.unstubAllEnvs();
  });
});
