import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { addAdminRsvp, adminEvents, cancelAdminEvent, clearCalCache, saveAdminEvent, type RawEvent } from "./cal.server";
import { cancelledMail, changedFacts, changedMail, cleanNote, uniqueRecipients } from "./event-mail.server";
import { checkEvent } from "./types";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/server/email", async (original) => ({ ...(await original<typeof import("@/server/email")>()), sendEmail: send }));

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const stored = (over: Partial<RawEvent> = {}): RawEvent => ({
  uid: "e1", slug: "supper", title: "Supper club", description: null, category: null, coverImageUrl: null, startTime: future(2), endTime: future(2.1),
  timeZone: "America/New_York", location: "The loft", capacity: 10, status: "SCHEDULED", host: { name: "Host", username: "twc" },
  goingCount: 2, maybeCount: 1, spotsLeft: 0, attendees: [], hidden: false, showAttendees: true, ...over,
});
const RSVPS = [
  { uid: "r1", name: "Ana Diaz", email: "Ana@X.test", status: "GOING", plusOnes: 0, note: null, updatedAt: "" },
  { uid: "r2", name: "Bea", email: "bea@x.test", status: "MAYBE", plusOnes: 0, note: null, updatedAt: "" },
  { uid: "r3", name: "Cy", email: "cy@x.test", status: "NOT_GOING", plusOnes: 0, note: null, updatedAt: "" },
];
const ADMIN = "00000000-0000-4000-8000-0000000000ad";

let db: DB;
let current: RawEvent;
const ctx = () => ({ db, actor: { id: ADMIN, email: "a@x.test" } });
beforeEach(() => {
  send.mockReset().mockResolvedValue({ sent: true });
  vi.stubEnv("CAL_API_KEY", "secret-test-key");
  vi.stubEnv("CAL_API_URL", "http://cal.test");
  vi.stubEnv("APP_URL", "https://club.test");
  clearCalCache();
  db = openDb(":memory:");
  const now = new Date().toISOString();
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'A', 'a@x.test', 1, ?, ?)`).run(ADMIN, now, now);
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
  db.prepare("insert into event_waitlist (event_uid, email, name) values ('e1', 'dee@x.test', 'Dee'), ('e1', 'ana@x.test', 'Ana again')").run();
  current = stored();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url.pathname.endsWith("/rsvps")) return Response.json({ status: "success", data: RSVPS });
    if (url.pathname.endsWith("/cancel")) { current = { ...current, status: "CANCELLED" }; return Response.json({ status: "success", data: {} }); }
    if (init?.method === "PATCH") current = { ...current, ...body };
    return Response.json({ status: "success", data: current });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); clearCalCache(); });
const settled = () => new Promise((r) => setTimeout(r, 0));
const recipients = () => send.mock.calls.map((c) => c[0].to).sort();
const input = (over: Partial<RawEvent>) => {
  const checked = checkEvent({ ...current, ...over });
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  return checked.value;
};

describe("moving an event", () => {
  it("emails Going, Maybe and the waitlist once each, never Can't go", async () => {
    const result = await saveAdminEvent(ctx(), { uid: "e1", event: input({ startTime: future(3), endTime: future(3.1) }) });
    await settled();
    expect(result.notified).toBe(3);
    expect(recipients()).toEqual(["ana@x.test", "bea@x.test", "dee@x.test"]);
    expect(send.mock.calls[0][0].text).toContain("https://club.test/events/supper");
  });

  it("emails a new place too", async () => {
    await saveAdminEvent(ctx(), { uid: "e1", event: input({ location: "The garden" }) });
    await settled();
    expect(send.mock.calls[0][0].text).toContain("Where: The garden");
  });

  it("emails nobody for a new title or description", async () => {
    const result = await saveAdminEvent(ctx(), { uid: "e1", event: input({ title: "Supper club II", description: "More" }) });
    await settled();
    expect(result.notified).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("emails nobody about a past or cancelled event, or a new one", async () => {
    current = stored({ startTime: future(-2), endTime: future(-1.9) });
    await saveAdminEvent(ctx(), { uid: "e1", event: input({ startTime: future(-3), endTime: future(-2.9) }) });
    current = stored({ status: "CANCELLED" });
    await saveAdminEvent(ctx(), { uid: "e1", event: input({ location: "Elsewhere" }) });
    await saveAdminEvent(ctx(), { event: input({ location: "Elsewhere" }) });
    await settled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("cancelling an event", () => {
  it("emails everyone on it with the admin's note, and clears the waitlist", async () => {
    const result = await cancelAdminEvent(ctx(), { uid: "e1", note: "Rain\u0007 — see you next week." });
    await settled();
    expect(result.notified).toBe(3);
    expect(recipients()).toEqual(["ana@x.test", "bea@x.test", "dee@x.test"]);
    expect(send.mock.calls[0][0].subject).toBe("Cancelled: Supper club");
    expect(send.mock.calls[0][0].text).toContain("Rain — see you next week.");
    expect(db.prepare("select count(*) n from event_waitlist where event_uid = 'e1'").get()).toEqual({ n: 0 });
  });

  it("emails nobody when the event had already ended", async () => {
    current = stored({ startTime: future(-2), endTime: future(-1.9) });
    expect((await cancelAdminEvent(ctx(), { uid: "e1" })).notified).toBe(0);
    await settled();
    expect(send).not.toHaveBeenCalled();
  });

  it("a failed send never undoes the cancel", async () => {
    send.mockResolvedValue({ sent: false, reason: "send-failed" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(cancelAdminEvent(ctx(), { uid: "e1" })).resolves.toEqual({ notified: 3 });
    expect(current.status).toBe("CANCELLED");
  });
});

describe("the emails", () => {
  const facts = { title: "Supper\nclub", slug: "supper", startTime: "2030-01-10T23:00:00.000Z", endTime: "2030-01-11T01:00:00.000Z", timeZone: "America/New_York", location: "Loft" };
  it("keep headers to one line and greet only a plain first name", () => {
    const mail = cancelledMail(facts, { name: "https://evil.test", email: "x@x.test" }, "");
    expect(mail.subject).toBe("Cancelled: Supper club");
    expect(mail.text.startsWith("Hi there,")).toBe(true);
  });
  it("say what it was before", () => {
    const text = changedMail(facts, { ...facts, location: "Garden" }, { name: "Ana", email: "a@x.test" }).text;
    expect(text).toContain("Where: Garden");
    expect(text).toContain(", Loft");
  });
  it("only a new time or place counts as a change", () => {
    expect(changedFacts(facts, { ...facts, title: "New" })).toBe(false);
    expect(changedFacts(facts, { ...facts, location: " Loft " })).toBe(false);
    expect(changedFacts(facts, { ...facts, endTime: "2030-01-11T02:00:00.000Z" })).toBe(true);
  });
  it("dedupe addresses and clean the note", () => {
    expect(uniqueRecipients([{ name: "A", email: "A@x.test" }, { name: "B", email: "a@x.test " }])).toEqual([{ name: "A", email: "a@x.test" }]);
    expect(cleanNote("one\r\ntwo\u0000")).toBe("one\ntwo");
  });
});

describe("a spot opening on a full event", () => {
  const alerts = () => send.mock.calls.filter((c) => /A spot opened/.test(c[0].subject));
  it("tells the admins once, with how many wait and a link, until the event fills again", async () => {
    current = stored({ spotsLeft: 1 });
    await addAdminRsvp(ctx(), { uid: "e1", rsvp: { name: "Cy", email: "cy@x.test", status: "NOT_GOING" } });
    await addAdminRsvp(ctx(), { uid: "e1", rsvp: { name: "Bea", email: "bea@x.test", status: "NOT_GOING" } });
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0][0].to).toBe("a@x.test");
    expect(alerts()[0][0].text).toContain("2 people on the waitlist");
    expect(alerts()[0][0].text).toContain("https://club.test/admin/events/e1");
    // Full again, someone joins the waitlist, then a spot opens: news again.
    db.prepare("delete from event_spot_alerts").run(); // what joinWaitlist does on a full event
    await addAdminRsvp(ctx(), { uid: "e1", rsvp: { name: "Cy", email: "cy@x.test", status: "NOT_GOING" } });
    expect(alerts()).toHaveLength(2);
  });

  it("says nothing while the event is full, or when nobody waits", async () => {
    current = stored({ spotsLeft: 0 });
    await addAdminRsvp(ctx(), { uid: "e1", rsvp: { name: "Cy", email: "cy@x.test", status: "MAYBE" } });
    db.prepare("delete from event_waitlist").run();
    current = stored({ spotsLeft: 3 });
    await addAdminRsvp(ctx(), { uid: "e1", rsvp: { name: "Cy", email: "cy@x.test", status: "NOT_GOING" } });
    expect(alerts()).toHaveLength(0);
  });

  it("counts who is waiting on the admin list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      return Response.json({ status: "success", data: url.searchParams.get("period") === "upcoming" ? [current] : [] });
    }));
    const list = await adminEvents(ctx(), { tab: "upcoming" });
    expect(list.events[0].waiting).toBe(2);
  });
});
