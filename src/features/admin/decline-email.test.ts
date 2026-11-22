import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/server/email", async (orig) => ({ ...(await orig<object>()), sendEmail }));

import { reviewApplication, setMemberStatus } from "./admin.server";
import { DECLINE_SUBJECT, declineText } from "./decline-email";
import { declineAndEmail } from "./decline-email.server";

const ADMIN = "00000000-0000-4000-8000-00000000000a";
const MEMBER = "00000000-0000-4000-8000-00000000000b";
let db: DB;
const as = (id: string) => ({ db, actor: { id, email: "x@x.test" } });
const addApp = (email = "rosa@x.test", userId: string | null = null) =>
  (db.prepare("insert into applications (email, full_name, user_id) values (?, 'Rosa Diaz', ?) returning id").get(email, userId) as { id: string }).id;
const appStatus = (id: string) => (db.prepare("select status from applications where id = ?").get(id) as { status: string }).status;
const memberStatus = () => (db.prepare("select status from profiles where id = ?").get(MEMBER) as { status: string }).status;

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://thewomenscollective.club/");
  sendEmail.mockReset().mockResolvedValue({ sent: true });
  db = openDb(":memory:");
  const now = new Date().toISOString();
  for (const [id, email] of [[ADMIN, "admin@x.test"], [MEMBER, "account@x.test"]]) {
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'Lena Ortiz', ?, 1, ?, ?)`).run(id, email, now, now);
  }
  db.prepare("update profiles set full_name = 'Lena Ortiz' where id = ?").run(MEMBER);
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
});
afterEach(() => vi.unstubAllEnvs());

describe("the decline email", () => {
  it("keeps the wording the owner approved, with no reason and no later yes", () => {
    const text = declineText("Rosa Diaz", "https://x.test/contact");
    expect(DECLINE_SUBJECT).toBe("About your application to The Women’s Collective");
    expect(text).toBe(`Dear Rosa Diaz,

Thank you for applying to The Women’s Collective, and for telling us about yourself and your work.

We read every application, and we aren’t able to offer you a membership.

We know this isn’t the answer you were hoping for, and we’re sorry to disappoint you. If you have a question, you can write to us here:
https://x.test/contact

Wishing you all the best,
The Women’s Collective
`);
    expect(declineText("  ", "u").startsWith("Hello,\n")).toBe(true);
  });

  it("is for admins only: a member changes nothing and sends nothing", async () => {
    const app = addApp();
    await expect(declineAndEmail(as(MEMBER), { kind: "application", id: app })).rejects.toThrow(/admins only/i);
    expect(appStatus(app)).toBe("pending");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses an unknown kind or id without sending", async () => {
    await expect(declineAndEmail(as(ADMIN), { kind: "booking", id: "x" })).rejects.toThrow(/invalid/i);
    await expect(declineAndEmail(as(ADMIN), { kind: "application", id: "missing" })).rejects.toThrow(/invalid/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("application: declines, then sends the approved email to the applicant", async () => {
    const app = addApp();
    expect(await declineAndEmail(as(ADMIN), { kind: "application", id: app })).toEqual({ sent: true });
    expect(appStatus(app)).toBe("declined");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({
      to: "rosa@x.test", subject: DECLINE_SUBJECT, text: declineText("Rosa Diaz", "https://thewomenscollective.club/contact"),
    });
  });

  it("sends at most once per decision; undo sends nothing, and declining again is a new decision", async () => {
    const app = addApp();
    const decline = () => declineAndEmail(as(ADMIN), { kind: "application", id: app });
    const [first, second] = await Promise.all([decline(), decline()]);
    expect([first, second]).toEqual([{ sent: true }, { sent: false, reason: "already-declined" }]);
    expect(await decline()).toEqual({ sent: false, reason: "already-declined" });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    reviewApplication(as(ADMIN), { id: app, status: "pending" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    await decline();
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("declining the plain way, on either path, sends nothing", () => {
    reviewApplication(as(ADMIN), { id: addApp(), status: "declined" });
    setMemberStatus(as(ADMIN), { id: MEMBER, status: "declined" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["reports a failure", () => sendEmail.mockResolvedValue({ sent: false, reason: "send-failed" }), "send-failed"],
    ["reports email not being set up", () => sendEmail.mockResolvedValue({ sent: false, reason: "not-configured" }), "not-configured"],
    ["survives a thrown send", () => sendEmail.mockRejectedValue(new Error("secret upstream detail")), "send-failed"],
  ] as const)("a failed send keeps the decline and %s", async (_name, arrange, reason) => {
    arrange();
    const app = addApp();
    expect(await declineAndEmail(as(ADMIN), { kind: "application", id: app })).toEqual({ sent: false, reason });
    expect(appStatus(app)).toBe("declined");
  });

  it("member: declines her and her newest application, and writes to that application's address", async () => {
    addApp("older@x.test", MEMBER);
    db.prepare("update applications set created_at = '2020-01-01T00:00:00.000Z'").run();
    const newest = addApp("newest@x.test", MEMBER);
    expect(await declineAndEmail(as(ADMIN), { kind: "member", id: MEMBER })).toEqual({ sent: true });
    expect(memberStatus()).toBe("declined");
    expect(appStatus(newest)).toBe("declined");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("newest@x.test");
  });

  it("member with no application: writes to her account's address", async () => {
    expect(await declineAndEmail(as(ADMIN), { kind: "member", id: MEMBER })).toEqual({ sent: true });
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "account@x.test", text: expect.stringContaining("Dear Lena Ortiz,") });
    expect(await declineAndEmail(as(ADMIN), { kind: "member", id: MEMBER })).toEqual({ sent: false, reason: "already-declined" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
