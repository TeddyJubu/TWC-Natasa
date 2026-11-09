// /contact messages and /partnerships inquiries: the shared checks, the plain-text emails, and POST /api/contact and
// /api/partnerships (size, per-IP limit, storage in inbox_messages, honeypot, delivery).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { rateLimit } from "@/server/request";
import type { Email, EmailResult } from "@/server/email";

const sent = vi.hoisted(() => ({ mails: [] as Email[], result: (_to: string): EmailResult => ({ sent: true }) }));
vi.mock("@/server/email", () => ({
  sendEmail: async (mail: Email) => {
    sent.mails.push(mail);
    return sent.result(mail.to);
  },
}));

import { checkContact, checkPartnership, LIMITS, TOPICS } from "./schema";
import { contactEmail, inboxRequest, partnershipEmail, type InboxKind } from "./contact.server";

const good = { name: "Rosa Diaz", email: "rosa@x.test", topic: TOPICS[2], message: "Coffee next week?", consent: true as const };
/** The public-pages partnership form's contract (migration/briefs/admin-inbox.md). */
const partner = {
  kind: "partnership", name: "Ana Ruiz", email: "ana@x.test", business: "Ruiz Bakery", collaboration_type: "supply",
  message: "We could bake for a gathering.", consent: true, honeypot: "",
};
let db: DB;
const ctx = () => ({ db, actor: null });

beforeAll(() => {
  db = openDb(":memory:");
  const now = new Date().toISOString();
  for (const [id, email] of [["a1", "admin1@x.test"], ["a2", "admin2@x.test"], ["m1", "member@x.test"]]) {
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'X', ?, 1, ?, ?)`).run(id, email, now, now);
  }
  db.prepare("insert into user_roles (user_id, role) values ('a1', 'admin'), ('a2', 'admin')").run();
});
afterEach(() => {
  db.prepare("delete from inbox_messages").run();
  sent.mails = [];
  sent.result = () => ({ sent: true });
});

/** A JSON POST whose body records whether anything read it. */
function post(body: string, headers: Record<string, string> = {}) {
  const state = { read: false };
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.read = true;
      controller.enqueue(bytes);
      controller.close();
    },
  }, { highWaterMark: 0 });
  const request = new Request("http://club.test/api/x", {
    method: "POST", body: stream, duplex: "half",
    headers: { "Content-Type": "application/json", "Content-Length": String(bytes.byteLength), ...headers },
  } as RequestInit);
  return { request, state };
}
const send = (ip: string, body: object = good, kind: InboxKind = "contact") =>
  inboxRequest(ctx(), post(JSON.stringify(body), { "cf-connecting-ip": ip }).request, kind);
const sendContactRequest = (c: ReturnType<typeof ctx>, request: Request) => inboxRequest(c, request, "contact");
const stored = () => db.prepare("select kind, name, email, topic, business, collaboration_type, message, status from inbox_messages order by rowid").all();

describe("checkContact", () => {
  it("trims a good message", () => {
    expect(checkContact({ ...good, name: "  Rosa Diaz ", message: " Coffee next week?\n" })).toEqual({ value: good });
  });

  it("names every problem, one per field", () => {
    const checked = checkContact({ name: " ", email: "nope", topic: "Gossip", message: "" });
    expect(checked).toEqual({
      errors: {
        name: "Please tell us your name.",
        email: "Please check your email: it should look like name@example.com.",
        topic: "Please choose what it’s about.",
        message: "Please write a message.",
        consent: "Please tick the box so we can hold your details to reply.",
      },
    });
    expect(Object.keys("errors" in checked ? checked.errors : {})).toEqual(["name", "email", "topic", "message", "consent"]);
  });

  it("takes a ticked form checkbox (\"on\") as consent, and nothing else", () => {
    expect(checkContact({ ...good, consent: "on" })).toEqual({ value: good });
    for (const consent of [undefined, false, "true", "yes", 1]) {
      expect(checkContact({ ...good, consent })).toEqual({ errors: { consent: "Please tick the box so we can hold your details to reply." } });
    }
  });

  it("refuses non-strings and over-long values", () => {
    expect(checkContact({ ...good, name: 42 })).toEqual({ errors: { name: "Please tell us your name." } });
    expect(checkContact({ ...good, message: "x".repeat(LIMITS.message + 1) })).toEqual({
      errors: { message: `Please keep your message under ${LIMITS.message} characters.` },
    });
  });
});

describe("checkPartnership", () => {
  it("trims a good inquiry; business is optional", () => {
    const { kind: _k, honeypot: _h, ...value } = partner;
    expect(checkPartnership({ ...partner, business: " Ruiz Bakery " })).toEqual({ value });
    expect(checkPartnership({ ...partner, business: undefined })).toEqual({ value: { ...value, business: "" } });
  });

  it("names every problem in form order, including the five collaboration types", () => {
    const checked = checkPartnership({ name: "", email: "", collaboration_type: "invest", business: "x".repeat(121), message: "" });
    expect("errors" in checked && Object.keys(checked.errors)).toEqual(["name", "business", "email", "collaboration_type", "message", "consent"]);
    for (const t of ["host", "teach", "supply", "support", "other"]) expect(checkPartnership({ ...partner, collaboration_type: t })).toHaveProperty("value");
  });
});

describe("contactEmail", () => {
  it("is plain text with the sender's address for a reply, and a one-line subject", () => {
    const mail = contactEmail({ ...good, name: "Rosa\r\nBcc: evil@x.test\u2028" });
    expect(mail.subject).toBe("Contact form: Partnerships — Rosa Bcc: evil@x.test");
    expect(mail.subject).not.toMatch(/[\r\n\u2028]/);
    expect(mail.text).toContain("From: Rosa Bcc: evil@x.test <rosa@x.test>");
    expect(mail.text).toContain("Coffee next week?");
    expect(mail.text).toContain("Reply to rosa@x.test");
  });
});

describe("partnershipEmail", () => {
  it("is plain text with the business and what they'd like to do", () => {
    const mail = partnershipEmail({ ...partner, collaboration_type: "supply", consent: true });
    expect(mail.subject).toBe("Partnership inquiry: supply — Ana Ruiz");
    expect(mail.text).toContain("Business: Ruiz Bakery");
    expect(mail.text).toContain("Reply to ana@x.test (this message came from the partnerships form");
  });
});

describe("rateLimit", () => {
  it("allows `limit` per IP per window, then refuses until the window has passed", () => {
    const allow = rateLimit(2, 1000);
    expect([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 2)]).toEqual([true, true, false, true]);
    expect(allow("a", 1001)).toBe(true);
  });
});

describe("POST /api/contact", () => {
  it("stores the message for the inbox, emails every admin and a confirmation to the sender, and answers 204", async () => {
    expect((await send("192.0.2.10")).status).toBe(204);
    expect(stored()).toEqual([{
      kind: "contact", name: "Rosa Diaz", email: "rosa@x.test", topic: "Partnerships", business: null, collaboration_type: null,
      message: "Coffee next week?", status: "new",
    }]);
    expect(sent.mails.map((m) => m.to).sort()).toEqual(["admin1@x.test", "admin2@x.test", "rosa@x.test"]);
    const admin = sent.mails.find((m) => m.to === "admin1@x.test")!;
    expect(admin.text).toContain("rosa@x.test");
    const confirm = sent.mails.find((m) => m.to === "rosa@x.test")!;
    expect(confirm.subject).toBe("We got your message");
    expect(confirm.text).toContain("Hi Rosa,");
    expect(confirm.text).toContain("contact form");
    expect(confirm.text).not.toContain("/admin");
  });

  it("still succeeds, stored, when no email goes out (the inbox has it)", async () => {
    sent.result = () => ({ sent: false, reason: "not-configured" });
    expect((await send("192.0.2.11")).status).toBe(204);
    expect(stored()).toHaveLength(1);
  });

  it("answers a filled honeypot with the same success, storing and sending nothing", async () => {
    for (const honeypot of ["http://spam.test", " ", 1, true]) expect((await send("192.0.2.16", { ...good, honeypot })).status).toBe(204);
    expect((await send("192.0.2.16", { ...partner, honeypot: "x" }, "partnership")).status).toBe(204);
    expect([stored(), sent.mails]).toEqual([[], []]);
    expect((await send("192.0.2.16", { ...good, honeypot: "" })).status).toBe(204);
    expect(stored()).toHaveLength(1);
  });

  it("refuses a message without consent, storing nothing", async () => {
    const res = await send("192.0.2.17", { ...good, consent: false });
    expect([res.status, (await res.json()).error]).toEqual([400, "Please tick the box so we can hold your details to reply."]);
    expect(stored()).toEqual([]);
  });

  it("refuses a body over 16 KB, or of unknown size, before reading it", async () => {
    const big = post("{}", { "Content-Length": String(16 * 1024 + 1), "cf-connecting-ip": "192.0.2.12" });
    expect((await sendContactRequest(ctx(), big.request)).status).toBe(413);
    const unsized = new Request("http://club.test/api/contact", { method: "POST" });
    expect((await sendContactRequest(ctx(), unsized)).status).toBe(411);
    expect(big.state.read).toBe(false);
    expect([stored(), sent.mails]).toEqual([[], []]);
  });

  it("allows 5 per client IP per 10 minutes, then 429 without reading the body", async () => {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await send("192.0.2.13")).status);
    expect(statuses).toEqual([204, 204, 204, 204, 204]);
    const sixth = post(JSON.stringify(good), { "cf-connecting-ip": "192.0.2.13" });
    expect((await sendContactRequest(ctx(), sixth.request)).status).toBe(429);
    expect(sixth.state.read).toBe(false);
    expect((await send("192.0.2.14")).status).toBe(204);
  });

  it("answers a malformed or invalid body with 400 and sends nothing", async () => {
    const res = await sendContactRequest(ctx(), post("{not json", { "cf-connecting-ip": "192.0.2.15" }).request);
    expect(res.status).toBe(400);
    const invalid = await send("192.0.2.15", { ...good, email: "nope" });
    expect([invalid.status, (await invalid.json()).error]).toEqual([400, "Please check your email: it should look like name@example.com."]);
    expect((await send("192.0.2.15", [good])).status).toBe(400);
    expect([stored(), sent.mails]).toEqual([[], []]);
  });
});

describe("POST /api/partnerships", () => {
  it("stores the inquiry (the brief's JSON contract), emails every admin, and confirms the sender", async () => {
    expect((await send("192.0.2.30", partner, "partnership")).status).toBe(204);
    expect(stored()).toEqual([{
      kind: "partnership", name: "Ana Ruiz", email: "ana@x.test", topic: null, business: "Ruiz Bakery", collaboration_type: "supply",
      message: "We could bake for a gathering.", status: "new",
    }]);
    expect(sent.mails.filter((m) => m.to.startsWith("admin")).map((m) => m.subject)).toEqual(Array(2).fill("Partnership inquiry: supply — Ana Ruiz"));
    const confirm = sent.mails.find((m) => m.to === "ana@x.test")!;
    expect(confirm.subject).toBe("Thanks for reaching out about a partnership");
    expect(confirm.text).toContain("Hi Ana,");
    expect(confirm.text).toContain("partnerships form");
    expect(confirm.text).not.toContain("/admin");
  });

  it("stores no business as null, and refuses an unknown collaboration type", async () => {
    expect((await send("192.0.2.31", { ...partner, business: "" }, "partnership")).status).toBe(204);
    expect(stored()).toMatchObject([{ business: null }]);
    const res = await send("192.0.2.31", { ...partner, collaboration_type: "invest" }, "partnership");
    expect([res.status, (await res.json()).error]).toEqual([400, "Please choose how you’d like to work with us."]);
  });

  it("has its own 5-per-10-minutes limit, separate from /contact's", async () => {
    for (let i = 0; i < 5; i++) expect((await send("192.0.2.32", partner, "partnership")).status).toBe(204);
    expect((await send("192.0.2.32", partner, "partnership")).status).toBe(429);
    expect((await send("192.0.2.32")).status).toBe(204);
  });

  it("refuses a body over 16 KB before reading it", async () => {
    const big = post("{}", { "Content-Length": String(16 * 1024 + 1), "cf-connecting-ip": "192.0.2.33" });
    expect((await inboxRequest(ctx(), big.request, "partnership")).status).toBe(413);
    expect(big.state.read).toBe(false);
  });
});

describe("inbox_messages (migration 0002)", () => {
  const insert = (sql: string) => () => db.prepare(`insert into inbox_messages (kind, name, email, topic, business, collaboration_type, message) values ${sql}`).run();
  it("keeps each kind's fields to that kind, and checks lengths and statuses in the database", () => {
    expect(insert("('contact', 'A', 'a@x.test', null, null, null, 'm')")).toThrow(/CHECK/);
    expect(insert("('contact', 'A', 'a@x.test', 'Press', 'Biz', null, 'm')")).toThrow(/CHECK/);
    expect(insert("('partnership', 'A', 'a@x.test', null, null, null, 'm')")).toThrow(/CHECK/);
    expect(insert("('partnership', 'A', 'a@x.test', null, null, 'invest', 'm')")).toThrow(/CHECK/);
    expect(insert("('newsletter', 'A', 'a@x.test', 'Press', null, null, 'm')")).toThrow(/CHECK/);
    expect(insert("('contact', 'A', 'not-an-email', 'Press', null, null, 'm')")).toThrow(/CHECK/);
    expect(insert("('contact', '', 'a@x.test', 'Press', null, null, 'm')")).toThrow(/CHECK/);
    insert("('contact', 'A', 'a@x.test', 'Press', null, null, 'm')")();
    expect(() => db.prepare("update inbox_messages set status = 'deleted'").run()).toThrow(/CHECK/);
  });
});
