import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { approvalEmail } from "./admin.server";

const fetchMock = vi.fn();
const ADMIN = "00000000-0000-4000-8000-00000000000a";
const MEMBER = "00000000-0000-4000-8000-00000000000b";
let db: DB;
const as = (id: string) => ({ db, actor: { id, email: "x@x.test" } });
const addApp = (status: string) =>
  (db.prepare("insert into applications (email, full_name, status) values ('rosa@x.test', 'Rosa Diaz', ?) returning id").get(status) as { id: string }).id;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CF_EMAIL_ACCOUNT_ID", "acct-123");
  vi.stubEnv("CF_EMAIL_API_TOKEN", "cf-secret-token");
  vi.stubEnv("APP_URL", "https://thewomenscollective.club/");
  vi.stubEnv("NODE_ENV", "production");
  db = openDb(":memory:");
  const now = new Date().toISOString();
  for (const id of [ADMIN, MEMBER]) {
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, '', ?, 1, ?, ?)`).run(id, `${id}@x.test`, now, now);
  }
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe("approvalEmail", () => {
  it("refuses a caller who isn't an admin, before reading or sending anything", () => {
    expect(() => approvalEmail(as(MEMBER), addApp("approved"))).toThrow(/admins only/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an application that isn't approved, or doesn't exist", async () => {
    expect(await approvalEmail(as(ADMIN), addApp("declined"))).toEqual({ sent: false, reason: "not-approved" });
    expect(await approvalEmail(as(ADMIN), "missing")).toEqual({ sent: false, reason: "not-approved" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not-configured without the Cloudflare settings", async () => {
    vi.stubEnv("CF_EMAIL_API_TOKEN", "");
    expect(await approvalEmail(as(ADMIN), addApp("approved"))).toEqual({ sent: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one plain-text welcome email linking to APP_URL/auth", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, result: {} })));
    expect(await approvalEmail(as(ADMIN), addApp("approved"))).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(["rosa@x.test"]);
    expect(body.subject).toBe("Welcome to The Women’s Collective");
    expect(body.text).toContain("Dear Rosa Diaz,");
    expect(body.text).toContain("https://thewomenscollective.club/auth");
  });
});
