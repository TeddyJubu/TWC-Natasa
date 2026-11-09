// /contact messages: the shared check, the plain-text email, and POST /api/contact (size, per-IP limit, delivery).
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

import { checkContact, LIMITS, TOPICS } from "./schema";
import { contactEmail, sendContactRequest } from "./contact.server";

const good = { name: "Rosa Diaz", email: "rosa@x.test", topic: TOPICS[2], message: "Coffee next week?" };
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
  const request = new Request("http://club.test/api/contact", {
    method: "POST", body: stream, duplex: "half",
    headers: { "Content-Type": "application/json", "Content-Length": String(bytes.byteLength), ...headers },
  } as RequestInit);
  return { request, state };
}
const send = (ip: string, body: object = good) => sendContactRequest(ctx(), post(JSON.stringify(body), { "cf-connecting-ip": ip }).request);

describe("checkContact", () => {
  it("trims a good message", () => {
    expect(checkContact({ ...good, name: "  Rosa Diaz ", message: " Coffee next week?\n" })).toEqual({ value: good });
  });

  it("names every problem, one per field", () => {
    expect(checkContact({ name: " ", email: "nope", topic: "Gossip", message: "" })).toEqual({
      errors: {
        name: "Please tell us your name.",
        email: "Please check your email: it should look like name@example.com.",
        topic: "Please choose what it’s about.",
        message: "Please write a message.",
      },
    });
  });

  it("refuses non-strings and over-long values", () => {
    expect(checkContact({ ...good, name: 42 })).toEqual({ errors: { name: "Please tell us your name." } });
    expect(checkContact({ ...good, message: "x".repeat(LIMITS.message + 1) })).toEqual({
      errors: { message: `Please keep your message under ${LIMITS.message} characters.` },
    });
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

describe("rateLimit", () => {
  it("allows `limit` per IP per window, then refuses until the window has passed", () => {
    const allow = rateLimit(2, 1000);
    expect([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 2)]).toEqual([true, true, false, true]);
    expect(allow("a", 1001)).toBe(true);
  });
});

describe("POST /api/contact", () => {
  it("emails every admin (only admins) and answers 204", async () => {
    expect((await send("192.0.2.10")).status).toBe(204);
    expect(sent.mails.map((m) => m.to).sort()).toEqual(["admin1@x.test", "admin2@x.test"]);
    expect(sent.mails[0]!.text).toContain("rosa@x.test");
  });

  it("succeeds when at least one send did, and is a 503 when none did", async () => {
    sent.result = (to) => (to === "admin2@x.test" ? { sent: true } : { sent: false, reason: "send-failed" });
    expect((await send("192.0.2.11")).status).toBe(204);
    sent.result = () => ({ sent: false, reason: "not-configured" });
    const res = await send("192.0.2.11");
    expect([res.status, (await res.json()).error]).toEqual([503, "We couldn’t send your message just now. Please try again in a little while."]);
  });

  it("refuses a body over 16 KB, or of unknown size, before reading it", async () => {
    const big = post("{}", { "Content-Length": String(16 * 1024 + 1), "cf-connecting-ip": "192.0.2.12" });
    expect((await sendContactRequest(ctx(), big.request)).status).toBe(413);
    const unsized = new Request("http://club.test/api/contact", { method: "POST" });
    expect((await sendContactRequest(ctx(), unsized)).status).toBe(411);
    expect(big.state.read).toBe(false);
    expect(sent.mails).toEqual([]);
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
    expect(sent.mails).toEqual([]);
  });
});
