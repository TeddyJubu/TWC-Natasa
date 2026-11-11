import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type DB } from "./db";

const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("./email", async (orig) => ({
  ...(await orig<object>()),
  sendEmail: async (mail: { to: string; subject: string; text: string }) => (sent.push(mail), { sent: true }),
}));

import { createAuth } from "./auth.server";

const APP = "https://club.test";
let db: DB;
let auth: ReturnType<typeof createAuth>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const linkIn = (text: string) => text.match(/https?:\/\/\S+/)![0];
const tokenIn = (url: string) => new URL(url).searchParams.get("token") ?? new URL(url).pathname.split("/").pop()!;
const row = <T,>(sql: string, ...args: string[]) => db.prepare(sql).get(...args) as T;

// Rate limits count per IP across the run, so each test signs in from its own address.
let testIp = 0;
const signIn = (email: string, password: string, ip = `203.0.113.${testIp}`) =>
  auth.handler(new Request(`${APP}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP, "X-Forwarded-For": ip },
    body: JSON.stringify({ email, password }),
  }));

async function signUp(email: string, name = "Rosa Diaz", password = "correct horse") {
  await auth.api.signUpEmail({ body: { email, password, name, callbackURL: "/account" } });
  return row<{ id: string }>(`select id from "user" where email = ?`, email.toLowerCase()).id;
}

beforeEach(() => {
  vi.stubEnv("APP_URL", APP);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret");
  vi.stubEnv("NODE_ENV", "production");
  db = openDb(":memory:");
  auth = createAuth(db);
  sent.length = 0;
  testIp++;
});
afterEach(() => vi.unstubAllEnvs());

describe("email + password", () => {
  it("signs up with a uuid id, a pending profile and the member role, and emails a verification link at APP_URL", async () => {
    const id = await signUp("Rosa@X.test");
    expect(id).toMatch(UUID);
    expect(row(`select full_name, status from profiles where id = ?`, id)).toEqual({ full_name: "Rosa Diaz", status: "pending" });
    expect(row(`select role from user_roles where user_id = ?`, id)).toEqual({ role: "member" });
    expect(sent).toHaveLength(1);
    expect(linkIn(sent[0].text).startsWith(`${APP}/api/auth/verify-email?token=`)).toBe(true);
  });

  it("requires the email to be verified before signing in, then sets an httpOnly session cookie", async () => {
    await signUp("rosa@x.test");
    expect((await signIn("rosa@x.test", "correct horse")).status).toBe(403);
    await auth.api.verifyEmail({ query: { token: tokenIn(linkIn(sent[0].text)) } });
    const res = await signIn("rosa@x.test", "correct horse");
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/session_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect((await signIn("rosa@x.test", "wrong password")).status).toBe(401);
  });

  it("verifying an email links that address's applications (any case) and applies an approved outcome", async () => {
    db.prepare(`insert into applications (email, full_name, status) values ('ROSA@x.test', 'Rosa', 'approved')`).run();
    const id = await signUp("rosa@x.test");
    expect(row<{ user_id: string | null }>(`select user_id from applications`).user_id).toBeNull();
    await auth.api.verifyEmail({ query: { token: tokenIn(linkIn(sent[0].text)) } });
    expect(row<{ user_id: string }>(`select user_id from applications`).user_id).toBe(id);
    expect(row<{ status: string; n: number | null }>(`select status, catalogue_number as n from profiles where id = ?`, id))
      .toEqual({ status: "approved", n: 11 });
  });


  it("lands every confirmation link on /verified, and a bad one there with ?error=", async () => {
    await signUp("rosa@x.test");
    await signIn("rosa@x.test", "correct horse"); // unverified: a second link, sent by sign-in
    expect(sent.map((m) => new URL(linkIn(m.text)).searchParams.get("callbackURL"))).toEqual(["/verified", "/verified"]);
    const bad = await auth.handler(new Request(`${APP}/api/auth/verify-email?token=nope&callbackURL=%2Fverified`));
    expect(bad.status).toBe(302);
    expect(bad.headers.get("location")).toBe("/verified?error=INVALID_TOKEN");
    const good = await auth.handler(new Request(linkIn(sent[1].text)));
    expect(good.headers.get("location")).toBe("/verified");
    expect(good.headers.get("set-cookie")).toMatch(/session_token=/);
  });

  it("resets a password through an emailed link at APP_URL", async () => {
    await signUp("rosa@x.test");
    await auth.api.verifyEmail({ query: { token: tokenIn(linkIn(sent[0].text)) } });
    await auth.api.requestPasswordReset({ body: { email: "rosa@x.test", redirectTo: "/reset-password" } });
    const link = linkIn(sent[1].text);
    expect(link.startsWith(`${APP}/api/auth/reset-password/`)).toBe(true);
    await auth.api.resetPassword({ body: { newPassword: "a new password", token: tokenIn(link) } });
    expect((await signIn("rosa@x.test", "a new password")).status).toBe(200);
    expect((await signIn("rosa@x.test", "correct horse")).status).toBe(401);
  });

  it("allows 20 password sign-ins per IP per 10 minutes, then refuses until the window passes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 21; i++) statuses.push((await signIn("nobody@x.test", "wrong password", "198.51.100.7")).status);
      expect(statuses.slice(0, 20)).toEqual(Array(20).fill(401));
      expect(statuses[20]).toBe(429);
      vi.advanceTimersByTime(9 * 60_000);
      expect((await signIn("nobody@x.test", "wrong password", "198.51.100.7")).status).toBe(429);
      vi.advanceTimersByTime(2 * 60_000);
      expect((await signIn("nobody@x.test", "wrong password", "198.51.100.7")).status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  }, 30_000); // every refused attempt still hashes a password

  it("allows 10 sign-ups per IP per 10 minutes", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await auth.handler(new Request(`${APP}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: APP, "X-Forwarded-For": "198.51.100.8" },
        body: JSON.stringify({ email: `new${i}@x.test`, password: "correct horse", name: "New Member" }),
      }))).status);
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
  }, 30_000); // every refused attempt still hashes a password
});

describe("rate-limit buckets behind Cloudflare → Caddy", () => {
  // Caddy's x-forwarded-for carries Cloudflare's edge address, shared by many members; cf-connecting-ip is theirs.
  const attempt = (headers: Record<string, string>) =>
    auth.handler(new Request(`${APP}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP, ...headers },
      body: JSON.stringify({ email: "nobody@x.test", password: "wrong password" }),
    })).then((r) => r.status);
  const edge = "172.70.1.1";

  it("count per cf-connecting-ip, not per shared x-forwarded-for", async () => {
    const first: number[] = [];
    for (let i = 0; i < 21; i++) first.push(await attempt({ "cf-connecting-ip": "198.51.100.21", "x-forwarded-for": edge }));
    expect(first).toContain(429);
    expect(await attempt({ "cf-connecting-ip": "198.51.100.22", "x-forwarded-for": edge })).toBe(401);
    expect(await attempt({ "cf-connecting-ip": "198.51.100.21", "x-forwarded-for": "172.70.9.9" })).toBe(429);
  }, 30_000); // every refused attempt still hashes a password

  it("fall back to x-forwarded-for without cf-connecting-ip", async () => {
    for (let i = 0; i < 20; i++) await attempt({ "x-forwarded-for": "198.51.100.31" });
    expect(await attempt({ "x-forwarded-for": "198.51.100.31" })).toBe(429);
    expect(await attempt({ "x-forwarded-for": "198.51.100.32" })).toBe(401);
  }, 30_000); // every refused attempt still hashes a password

  it("are configured to read cf-connecting-ip, then x-forwarded-for", () =>
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["cf-connecting-ip", "x-forwarded-for"]));
});

describe("configuration", () => {
  it.each([["production"], ["development"], ["test"]])("refuses a missing or short BETTER_AUTH_SECRET (NODE_ENV=%s)", (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(() => createAuth(db)).toThrow(/BETTER_AUTH_SECRET/);
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(31));
    expect(() => createAuth(db)).toThrow(/at least 32/);
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    expect(() => createAuth(db)).not.toThrow();
  });

  it("is checked when the server starts, not on the first sign-in", () =>
    expect(readFileSync("src/server.ts", "utf8")).toMatch(/^authSecret\(\);$/m));

  it("trusts APP_URL, plus the dev server only outside production", async () => {
    expect(auth.options.trustedOrigins).toEqual([APP]);
    vi.stubEnv("NODE_ENV", "development");
    expect(createAuth(db).options.trustedOrigins).toEqual([APP, "http://localhost:8080"]);
  });

  it("offers Google only when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set", () => {
    expect(auth.options.socialProviders).toEqual({});
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    expect(createAuth(db).options.socialProviders).toEqual({});
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    expect(createAuth(db).options.socialProviders).toMatchObject({ google: { clientId: "id", clientSecret: "secret" } });
  });
});

describe("delete my account (POST /api/auth/delete-user)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "twc-delete-"));
    vi.stubEnv("DATA_DIR", dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function signedIn(email: string) {
    const id = await signUp(email);
    await auth.api.verifyEmail({ query: { token: tokenIn(linkIn(sent.at(-1)!.text)) } });
    const res = await signIn(email, "correct horse");
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    return { id, cookie };
  }
  const del = async (cookie: string, body: Record<string, unknown>) => {
    const res = await auth.handler(new Request(`${APP}/api/auth/delete-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP, Cookie: cookie, "X-Forwarded-For": `203.0.113.${testIp}` },
      body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json().catch(() => null)) as { code?: string } | null };
  };
  const users = (id: string) => (db.prepare(`select count(*) as n from "user" where id = ?`).get(id) as { n: number }).n;
  const put = (...parts: string[]) => {
    mkdirSync(join(dir, "uploads", ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(dir, "uploads", ...parts), "x");
  };

  it("with her password: deletes her, her profile, her applications (by account or email) and her upload folders", async () => {
    const rosa = await signedIn("rosa@x.test");
    const lena = await signedIn("lena@x.test");
    const app = (email: string, user: string | null) =>
      db.prepare(`insert into applications (email, full_name, user_id) values (?, 'A', ?) returning id`).get(email, user) as { id: string };
    const mine = app("ROSA@x.test", null);
    app("rosa.old@x.test", rosa.id);
    app("lena@x.test", lena.id);
    db.prepare(`insert into admin_notes (application_id, body) values (?, 'note')`).run(mine.id);
    put("avatars", rosa.id, "portrait-1.webp"); put("feed", rosa.id, "p-1.webp"); put("avatars", lena.id, "portrait-1.webp");

    expect(await del(rosa.cookie, { password: "correct horse" })).toEqual({ status: 200, body: { success: true, message: "User deleted" } });
    expect(users(rosa.id)).toBe(0);
    expect(row(`select count(*) as n from profiles where id = ?`, rosa.id)).toEqual({ n: 0 });
    expect(row(`select count(*) as n from session where userId = ?`, rosa.id)).toEqual({ n: 0 });
    expect(db.prepare(`select email from applications`).all()).toEqual([{ email: "lena@x.test" }]);
    expect(row(`select count(*) as n from admin_notes`)).toEqual({ n: 0 });
    expect(existsSync(join(dir, "uploads", "avatars", rosa.id))).toBe(false);
    expect(existsSync(join(dir, "uploads", "feed", rosa.id))).toBe(false);
    expect(existsSync(join(dir, "uploads", "avatars", lena.id, "portrait-1.webp"))).toBe(true);
    expect(users(lena.id)).toBe(1);
  });

  it("deletes her imported record too, so a declined imported member can't come back approved by signing up again", async () => {
    db.prepare(`insert into legacy_members (legacy_id, email, full_name, bio, member_since) values ('m-1', 'rosa@x.test', 'Rosa', 'Old bio', '2020-01-01')`).run();
    db.prepare(`insert into legacy_members (legacy_id, email, full_name) values ('m-2', 'lena@x.test', 'Lena')`).run();
    const rosa = await signedIn("rosa@x.test");
    expect(row(`select status from profiles where id = ?`, rosa.id)).toEqual({ status: "approved" });
    db.prepare(`update profiles set status = 'declined' where id = ?`).run(rosa.id);

    expect((await del(rosa.cookie, { password: "correct horse" })).status).toBe(200);
    expect(db.prepare(`select legacy_id from legacy_members`).all()).toEqual([{ legacy_id: "m-2" }]);

    const again = await signedIn("rosa@x.test");
    expect(row(`select status, bio, member_since from profiles where id = ?`, again.id)).toEqual({ status: "pending", bio: "", member_since: null });
  });

  it("a password account needs its password: none or a wrong one deletes nothing", async () => {
    const rosa = await signedIn("rosa@x.test");
    db.prepare(`insert into applications (email, full_name) values ('rosa@x.test', 'Rosa')`).run();
    put("avatars", rosa.id, "portrait-1.webp");
    expect(await del(rosa.cookie, {})).toMatchObject({ status: 400, body: { code: "PASSWORD_REQUIRED" } });
    expect(await del(rosa.cookie, { password: "" })).toMatchObject({ status: 400, body: { code: "PASSWORD_REQUIRED" } });
    expect(await del(rosa.cookie, { password: "wrong password" })).toMatchObject({ status: 400, body: { code: "INVALID_PASSWORD" } });
    expect(users(rosa.id)).toBe(1);
    expect(row(`select count(*) as n from applications`)).toEqual({ n: 1 });
    expect(existsSync(join(dir, "uploads", "avatars", rosa.id, "portrait-1.webp"))).toBe(true);
  });

  it("signed out, or with a deletion token, deletes nothing", async () => {
    const rosa = await signedIn("rosa@x.test");
    expect((await del("", { password: "correct horse" })).status).toBe(401);
    expect(await del(rosa.cookie, { password: "correct horse", token: "abc" })).toMatchObject({ status: 400, body: { code: "TOKEN_NOT_SUPPORTED" } });
    expect(users(rosa.id)).toBe(1);
  });

  it("an admin can't delete herself this way, even with her password", async () => {
    const rosa = await signedIn("rosa@x.test");
    db.prepare(`insert into user_roles (user_id, role) values (?, 'admin')`).run(rosa.id);
    db.prepare(`insert into applications (email, full_name) values ('rosa@x.test', 'Rosa')`).run();
    put("avatars", rosa.id, "portrait-1.webp");
    expect(await del(rosa.cookie, { password: "correct horse" })).toMatchObject({ status: 403, body: { code: "ADMIN_CANNOT_DELETE" } });
    expect(users(rosa.id)).toBe(1);
    expect(row(`select count(*) as n from applications`)).toEqual({ n: 1 });
    expect(existsSync(join(dir, "uploads", "avatars", rosa.id, "portrait-1.webp"))).toBe(true);
  });

  it("a Google-only account (no password) needs a fresh session: within a day it deletes, after that it's refused", async () => {
    const rosa = await signedIn("rosa@x.test");
    db.prepare(`update account set providerId = 'google', password = null where userId = ?`).run(rosa.id);
    const created = row<{ createdAt: string | number }>(`select createdAt from session where userId = ?`, rosa.id).createdAt;
    const old = new Date(Date.now() - 2 * 86_400_000);
    db.prepare(`update session set createdAt = ? where userId = ?`).run(typeof created === "number" ? old.getTime() : old.toISOString(), rosa.id);
    expect(await del(rosa.cookie, {})).toMatchObject({ status: 400, body: { code: "SESSION_EXPIRED" } });
    expect(users(rosa.id)).toBe(1);
    db.prepare(`update session set createdAt = ? where userId = ?`).run(created, rosa.id);
    expect((await del(rosa.cookie, {})).status).toBe(200);
    expect(users(rosa.id)).toBe(0);
  });
});
