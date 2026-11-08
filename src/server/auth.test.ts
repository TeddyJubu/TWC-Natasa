import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
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

  it("accepts a legacy bcrypt hash imported from Supabase", async () => {
    const now = new Date().toISOString();
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values ('00000000-0000-4000-8000-000000000001', 'Old', 'old@x.test', 1, ?, ?)`).run(now, now);
    db.prepare(`insert into account (id, accountId, providerId, userId, password, createdAt, updatedAt) values ('a1', '00000000-0000-4000-8000-000000000001', 'credential', '00000000-0000-4000-8000-000000000001', ?, ?, ?)`)
      .run(bcrypt.hashSync("legacy pass", 4), now, now);
    expect((await signIn("old@x.test", "legacy pass")).status).toBe(200);
    expect((await signIn("old@x.test", "not it")).status).toBe(401);
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

  it("rate-limits repeated sign-in attempts", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await signIn("nobody@x.test", "wrong password", "198.51.100.7")).status);
    expect(statuses).toContain(429);
  });
});

describe("configuration", () => {
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
