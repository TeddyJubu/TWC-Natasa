// The admin alert for a new membership application: sent after POST /api/applications stores one, to every admin, and
// never able to fail the request (the application is already stored). No answer dump (OPS-384 retired).
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import type { Ctx } from "@/server/context.server";
import type { Email, EmailResult } from "@/server/email";

const sent = vi.hoisted(() => ({ mails: [] as Email[], result: (_to: string): EmailResult | Promise<EmailResult> => ({ sent: true }) }));
vi.mock("@/server/email", async (orig) => ({
  ...(await orig<typeof import("@/server/email")>()),
  sendEmail: async (mail: Email) => {
    sent.mails.push(mail);
    return sent.result(mail.to);
  },
}));

import { submitApplicationRequest } from "./applications.server";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const [ADMIN, ADMIN2] = [id("a"), id("d")];
let db: DB;
const as = (who: string | null): Ctx => ({ db, actor: who ? { id: who, email: `${who}@x.test` } : null });
const addUser = (who: string, email: string) =>
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, '', ?, 1, ?, ?)`).run(who, email, "2026-01-01", "2026-01-01");
const post = (body: unknown, ip = "203.0.113.9") => {
  const text = JSON.stringify(body);
  return submitApplicationRequest(as(null), new Request("https://new.example/api/applications", {
    method: "POST", body: text, headers: { "content-type": "application/json", "content-length": String(text.length), "cf-connecting-ip": ip },
  }));
};
const apply = (extra: Record<string, unknown> = {}) => ({
  email: "bea@x.test", fullName: "Bea Lopez", neighborhood: "Astoria", answers: { pitch: "private notes", newsletter: "no" }, ...extra,
});

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://new.example/");
  sent.mails = [];
  sent.result = () => ({ sent: true });
  db = openDb(":memory:");
  addUser(ADMIN, "admin@x.test");
  addUser(ADMIN2, "admin2@x.test");
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN2);
});
afterAll(() => vi.unstubAllEnvs());

describe("application-received alert", () => {
  it("emails every admin once with who applied and where to read it — and none of the answers", async () => {
    expect((await post(apply())).status).toBe(204);
    expect(sent.mails.map((m) => m.to).sort()).toEqual(["admin2@x.test", "admin@x.test"]);
    const [mail] = sent.mails;
    expect(mail!.subject).toBe("New application: Bea Lopez");
    expect(mail!.text).toContain("Bea Lopez has sent a membership application.");
    expect(mail!.text).toContain("https://new.example/admin#applications");
    expect(mail!.text).not.toContain("private notes");
    expect(mail!.text).not.toContain("bea@x.test");
  });

  it("is not sent for a malformed or invalid body", async () => {
    const bad = new Request("https://new.example/api/applications", {
      method: "POST", body: "{not json", headers: { "content-type": "application/json", "content-length": "9", "cf-connecting-ip": "203.0.113.20" },
    });
    expect((await submitApplicationRequest(as(null), bad)).status).toBe(400);
    expect((await post({ email: "bea@x.test", fullName: "Bea", answers: "not-an-object" })).status).toBe(400);
    expect(sent.mails).toEqual([]);
  });

  it("a failing or unconfigured mailer still answers 204 with the application stored", async () => {
    sent.result = () => ({ sent: false, reason: "send-failed" });
    expect((await post(apply({ email: "a@x.test" }), "203.0.113.10")).status).toBe(204);
    sent.result = () => { throw new Error("mail down"); };
    expect((await post(apply({ email: "b@x.test" }), "203.0.113.11")).status).toBe(204);
    expect(db.prepare("select count(*) as n from applications").get()).toEqual({ n: 2 });
  });

  it("strips line breaks from the applicant's name so it can't inject a header", async () => {
    await post(apply({ fullName: "Bea\r\nBcc: x@evil.test" }), "203.0.113.12");
    expect(sent.mails[0]!.subject).toBe("New application: Bea Bcc: x@evil.test");
  });
});
