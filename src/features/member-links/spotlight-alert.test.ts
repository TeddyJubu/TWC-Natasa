// The admin alert for a new Weekly Spotlight answer: sent after POST /api/spotlight stores one, to every admin, never
// for a bot or a bad link, and never able to fail the request (the answer is already stored and the link used).
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

import { mintReviewLink } from "./member-links.server";
import { spotlightRequest } from "./spotlight.server";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const [ADMIN, ADMIN2, BEA] = [id("a"), id("d"), id("b")];
let db: DB;
const as = (who: string | null): Ctx => ({ db, actor: who ? { id: who, email: `${who}@x.test` } : null });
const addUser = (who: string, email: string) =>
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, '', ?, 1, ?, ?)`).run(who, email, "2026-01-01", "2026-01-01");
const post = (body: unknown) => {
  const text = JSON.stringify(body);
  return spotlightRequest(as(null), new Request("https://new.example/api/spotlight", {
    method: "POST", body: text, headers: { "content-type": "application/json", "content-length": String(text.length), "cf-connecting-ip": "203.0.113.8" },
  }));
};
const story = (token: string, extra: Record<string, unknown> = {}) => ({
  token, full_name: "Bea Lopez", q_what_inspired_you_to_start: "Books.", q_what_are_you_currently_focused_on: "A second shop.",
  q_what_are_you_most_proud_of: "Ten years.", q_one_fact_others_should_know: "I bind them myself.", ...extra,
});
const newToken = () => new URL(mintReviewLink(as(ADMIN), { member_id: BEA, purpose: "spotlight" }).url).searchParams.get("t")!;

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://new.example/");
  sent.mails = [];
  sent.result = () => ({ sent: true });
  db = openDb(":memory:");
  addUser(ADMIN, "admin@x.test");
  addUser(ADMIN2, "admin2@x.test");
  addUser(BEA, "bea@x.test");
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN2);
  db.prepare("update profiles set status = 'approved', full_name = 'Bea Lopez' where id = ?").run(BEA);
});
afterAll(() => vi.unstubAllEnvs());

describe("spotlight-received alert", () => {
  it("emails every admin once with who answered and where to read it — and none of the answers", async () => {
    expect((await post(story(newToken(), { q_community_never_do: "private notes" }))).status).toBe(204);
    expect(sent.mails.map((m) => m.to).sort()).toEqual(["admin2@x.test", "admin@x.test"]);
    const [mail] = sent.mails;
    expect(mail!.subject).toBe("Spotlight answer: Bea Lopez");
    expect(mail!.text).toContain("Bea Lopez has sent a Weekly Spotlight answer.");
    expect(mail!.text).toContain("https://new.example/admin#spotlight");
    expect(mail!.text).not.toContain("private notes");
    expect(mail!.text).not.toContain("Books.");
  });

  it("is not sent for a bad link, a failed check or a bot", async () => {
    expect((await post(story("x".repeat(43)))).status).toBe(404);
    const token = newToken();
    expect((await post(story(token, { q_what_inspired_you_to_start: "" }))).status).toBe(400);
    expect((await post(story(token, { honeypot: "spam" }))).status).toBe(204);
    expect(sent.mails).toEqual([]);
  });

  it("is sent once: a second post on the used link is a 404 with no second alert", async () => {
    const token = newToken();
    await post(story(token));
    expect((await post(story(token))).status).toBe(404);
    expect(sent.mails).toHaveLength(2); // two admins, one answer
  });

  it("a failing or unconfigured mailer still answers 204 with the answer stored", async () => {
    sent.result = () => ({ sent: false, reason: "send-failed" });
    expect((await post(story(newToken()))).status).toBe(204);
    sent.result = () => { throw new Error("mail down"); };
    expect((await post(story(newToken()))).status).toBe(204);
    expect(db.prepare("select count(*) as n from spotlight_answers").get()).toEqual({ n: 2 });
  });

  it("strips line breaks from the member's name so it can't inject a header", async () => {
    await post(story(newToken(), { full_name: "Bea\r\nBcc: x@evil.test" }));
    expect(sent.mails[0]!.subject).toBe("Spotlight answer: Bea Bcc: x@evil.test");
  });
});
