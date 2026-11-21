import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CalError, clearCalCache, createBooking, filterPublic, getPublicBooking, getPublicEvent, getSlots, listPublicEvents, manageBooking,
  sendRsvp, sitemapEvents, toCalError, toPublicEvent, type RawEvent,
} from "./cal.server";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const event = (uid: string, over: Partial<RawEvent> = {}): RawEvent => ({
  uid, slug: uid, title: `Event ${uid}`, description: null, category: null, coverImageUrl: null, startTime: future(2), endTime: future(3),
  timeZone: "America/New_York", location: null, capacity: null, status: "SCHEDULED", host: { name: "Host", username: "twc" },
  goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [], ...over,
});

type Call = { url: URL; method: string; body: unknown; headers: Headers };
let calls: Call[] = [];
let answer: (call: Call) => Response;
const ok = (data: unknown) => Response.json({ status: "success", data });

beforeEach(() => {
  calls = [];
  vi.stubEnv("CAL_API_KEY", "secret-test-key");
  vi.stubEnv("CAL_API_URL", "http://cal.test");
  vi.stubEnv("CAL_WEB_URL", "https://cal.example");
  vi.stubEnv("CAL_WEB_PRIVATE_URL", "http://cal-web.test");
  clearCalCache();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const call = { url: new URL(String(input)), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: new Headers(init?.headers) };
    calls.push(call);
    return answer(call);
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearCalCache();
});
const eventsApi = (events: RawEvent[]) => (c: Call) => {
  if (c.url.pathname.endsWith("/me")) return ok({ username: "twc", name: "TWC" });
  return ok(c.url.searchParams.get("period") === "upcoming" ? events : []);
};

describe("toCalError", () => {
  it.each([
    [`Cal API 409: {"message":"RSVP exists"}`, 409, "RSVP_EXISTS"],
    [`Cal API 409: {"message":"Event is full"}`, 409, "EVENT_FULL"],
    [`Cal API 409: {"message":"conflict"}`, 409, "SLOT_TAKEN"],
    [`Cal API 400: {"message":"no_available_users_found"}`, 400, "SLOT_TAKEN"],
    [`Cal API 400: {"message":"nope"}`, 400, "BAD_REQUEST"],
    [`Cal API 401: {}`, 403, "FORBIDDEN"],
    [`Cal API 403: {}`, 403, "FORBIDDEN"],
    [`Cal API 404: {}`, 404, "NOT_FOUND"],
    [`Cal API 429: {}`, 429, "RATE_LIMITED"],
    [`Cal API 500: {}`, 503, "UNAVAILABLE"],
    ["socket hang up", 503, "UNAVAILABLE"],
  ])("%s", (message, status, code) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(toCalError(new Error(message))).toMatchObject({ status, code });
  });
  it("names a duplicate guest, and a dead seat as not found (real Cal's refusals)", () => {
    expect(toCalError(new Error(`Cal API 400: {"error":{"message":"emails_must_be_unique_valid"}}`)).message).toMatch(/already on this booking/);
    expect(toCalError(new Error(`Cal API 400: {"error":{"message":"Invalid seatUid: this seat does not exist"}}`))).toMatchObject({ status: 404 });
  });
  it("never repeats Cal's body, which can hold personal details", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(toCalError(new Error(`Cal API 500: {"email":"guest@x.test"}`)).message).not.toContain("guest@x.test");
    expect(toCalError(new Error(`Cal API 400: {"email":"guest@x.test"}`)).message).not.toContain("guest@x.test");
  });
});

describe("public events", () => {
  it("never lists a hidden event, in any tab, filter or page", async () => {
    answer = eventsApi([event("shown", { category: "Supper" }), event("secret", { hidden: true, category: "Secret" })]);
    const list = await listPublicEvents({});
    expect(list.events.map((e) => e.uid)).toEqual(["shown"]);
    expect(list.total).toBe(1);
    expect(list.categories).toEqual(["Supper"]);
    expect((await listPublicEvents({ tab: "all", q: "secret" })).events).toEqual([]);
    expect(filterPublic([event("x", { hidden: true })], { tab: "all" })).toEqual([]);
  });
  it("reaches a hidden event only by direct link, marked unlisted", async () => {
    answer = eventsApi([event("secret", { hidden: true })]);
    expect(await getPublicEvent("secret")).toMatchObject({ uid: "secret", unlisted: true });
    await expect(getPublicEvent("nope")).rejects.toMatchObject({ status: 404 });
  });
  it("keeps hidden and cancelled events out of the sitemap, and survives an outage", async () => {
    answer = eventsApi([event("shown"), event("secret", { hidden: true }), event("off", { status: "CANCELLED" })]);
    expect((await sitemapEvents()).map((e) => e.slug)).toEqual(["shown"]);
    clearCalCache();
    answer = () => new Response("down", { status: 502 });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sitemapEvents()).toEqual([]);
  });
  it("passes only allowlisted fields: no email, note or RSVP detail", () => {
    const raw = event("e", { attendees: ["Rosa Diaz", "  Mei  Lin "], ownerEmail: "owner@x.test", rsvps: [{ email: "guest@x.test", note: "private" }], hidden: false } as Partial<RawEvent>);
    const out = JSON.stringify(toPublicEvent(raw));
    for (const leak of ["owner@x.test", "guest@x.test", "private", "Diaz", "Lin", "hidden"]) expect(out).not.toContain(leak);
    expect(toPublicEvent(raw).attendees).toEqual(["Rosa", "Mei"]);
    expect(toPublicEvent({ ...raw, showAttendees: false }).attendees).toEqual([]);
  });
  it("searches accents-insensitively, before paging", async () => {
    answer = eventsApi([event("a", { title: "Café social" }), event("b", { title: "Book club" })]);
    expect((await listPublicEvents({ q: "cafe" })).events.map((e) => e.uid)).toEqual(["a"]);
  });
});

describe("the RSVP proxy", () => {
  const rsvp = { name: "Rosa", email: "Rosa@X.test", status: "GOING" };
  it("posts to Cal's public endpoint with the visitor's IP and without the API key", async () => {
    answer = () => ok({ uid: "r1", status: "GOING", plusOnes: 0 });
    expect(await sendRsvp("evt1", rsvp, "203.0.113.9")).toEqual({ uid: "r1", status: "GOING", plusOnes: 0 });
    const [call] = calls;
    expect(call.url.href).toBe("http://cal-web.test/api/community-events/evt1/rsvp");
    expect(call.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
    expect(call.headers.get("authorization")).toBeNull();
    expect(call.body).toEqual({ name: "Rosa", email: "rosa@x.test", status: "GOING" });
  });
  it("sends the stored uid on a change", async () => {
    answer = () => ok({ uid: "r1", status: "MAYBE", plusOnes: 0 });
    await sendRsvp("evt1", { ...rsvp, status: "MAYBE", rsvpUid: "r1" }, "unknown");
    expect(calls[0].body).toMatchObject({ rsvpUid: "r1", status: "MAYBE" });
    expect(calls[0].headers.get("cf-connecting-ip")).toBeNull();
  });
  it.each([
    [409, { error: "EVENT_FULL" }, "EVENT_FULL"],
    [409, { error: "RSVP_EXISTS" }, "RSVP_EXISTS"],
    [429, {}, "RATE_LIMITED"],
    [404, {}, "NOT_FOUND"],
    [400, {}, "BAD_REQUEST"],
    [500, {}, "UNAVAILABLE"],
  ])("maps %i %o", async (status, body, code) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    answer = () => Response.json(body, { status });
    await expect(sendRsvp("evt1", rsvp, "unknown")).rejects.toMatchObject({ code });
  });
  it("refuses bad input before any request", async () => {
    await expect(sendRsvp("evt1", { name: "", email: "no", status: "GOING" }, "unknown")).rejects.toBeInstanceOf(CalError);
    expect(calls).toEqual([]);
  });
});

describe("the seat-id rule", () => {
  const seated = {
    uid: "shared", title: "Group", start: future(2), end: future(3), status: "accepted", eventTypeId: 7,
    attendees: [
      { name: "Ann Seat", email: "ann@x.test", timeZone: "UTC", seatUid: "seat-a" },
      { name: "Bea Seat", email: "bea@x.test", timeZone: "UTC", seatUid: "seat-b" },
    ],
  };
  const api = (booking: object, more: (c: Call) => Response | undefined = () => undefined) => (c: Call) => {
    const extra = more(c);
    if (extra) return extra;
    if (c.url.pathname.endsWith("/me")) return ok({ username: "twc" });
    if (c.url.pathname.endsWith("/event-types")) return ok([{ id: 7, slug: "group", title: "Group", lengthInMinutes: 30, seats: { seatsPerTimeSlot: 3 } }]);
    return ok(booking);
  };
  it.each([[undefined], [null], ["wrong"], [""]])("a shared uid opens nothing with seat %s", async (seat) => {
    answer = api(seated);
    await expect(getPublicBooking("shared", seat)).rejects.toMatchObject({ status: 404 });
  });
  it("shows only that person's own details", async () => {
    answer = api(seated);
    const booking = await getPublicBooking("shared", "seat-b");
    expect(booking).toMatchObject({ seatUid: "seat-b", attendeeName: "Bea Seat", guestsAllowed: false });
    const out = JSON.stringify(booking);
    for (const leak of ["ann@x.test", "bea@x.test", "Ann", "seat-a"]) expect(out).not.toContain(leak);
  });
  it.each(["cancel", "reschedule", "guests"])("%s is refused without the person's seat", async (action) => {
    answer = api(seated);
    await expect(manageBooking("shared", { action, seatUid: "wrong", start: future(4), guests: ["g@x.test"] })).rejects.toMatchObject({ status: 404 });
    expect(calls.filter((c) => c.method === "POST")).toEqual([]);
  });
  it("cancels only her seat, with the reason Cal requires", async () => {
    answer = api(seated, (c) => (c.method === "POST" ? ok({ uid: "shared" }) : undefined));
    await manageBooking("shared", { action: "cancel", seatUid: "seat-a" });
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url.pathname).toBe("/v2/bookings/shared/cancel");
    expect(post.body).toEqual({ seatUid: "seat-a", cancellationReason: "Cancelled by the attendee" });
  });
  it("reschedules her seat and returns the new uid and seat", async () => {
    answer = api(seated, (c) => (c.method === "POST" ? ok({ uid: "moved", seatUid: "seat-new" }) : undefined));
    const start = future(5);
    expect(await manageBooking("shared", { action: "reschedule", seatUid: "seat-a", start })).toEqual({ uid: "moved", seatUid: "seat-new" });
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ start, seatUid: "seat-a" });
  });
  it("a group session takes no added guests", async () => {
    answer = api(seated);
    await expect(manageBooking("shared", { action: "guests", seatUid: "seat-a", guests: ["g@x.test"] })).rejects.toMatchObject({ status: 400 });
  });
  it("a one-to-one booking needs no seat", async () => {
    answer = api({ ...seated, attendees: [{ name: "Solo", email: "s@x.test", timeZone: "UTC" }] });
    expect(await getPublicBooking("shared")).toMatchObject({ seatUid: null, attendeeName: "Solo" });
  });
});

describe("slots and booking", () => {
  const types: { id: number; slug: string; title: string; lengthInMinutes: number; hidden?: boolean; bookingFields?: Record<string, unknown>[] }[] = [
    { id: 7, slug: "open", title: "Open", lengthInMinutes: 30, bookingFields: [{ slug: "topic", type: "text", label: "Topic", required: true }, { slug: "name", type: "name", isDefault: true }] },
    { id: 8, slug: "off", title: "Off", lengthInMinutes: 30, hidden: true },
  ];
  const api = (c: Call) => {
    if (c.url.pathname.endsWith("/me")) return ok({ username: "twc" });
    if (c.url.pathname.endsWith("/event-types")) return ok(types);
    if (c.url.pathname.endsWith("/slots")) return ok({ "2026-12-01": [{ start: "2026-12-01T15:00:00.000Z", bookingUid: "shared-key", seatsRemaining: 2, seatsBooked: 1, seatsTotal: 3 }] });
    return ok({ uid: "b1", seatUid: "s1" });
  };
  const range = { start: future(1), end: future(5), timeZone: "UTC" };
  it("drops a seated slot's shared booking uid", async () => {
    answer = api;
    const out = await getSlots({ eventTypeId: 7, ...range });
    expect(JSON.stringify(out)).not.toContain("shared-key");
    expect(out["2026-12-01"][0].seatsRemaining).toBe(2);
  });
  it("won't show a hidden type's times", async () => {
    answer = api;
    await expect(getSlots({ eventTypeId: 8, ...range })).rejects.toMatchObject({ status: 404 });
  });
  const form = { eventTypeId: 7, start: future(2), name: "Rosa", email: "rosa@x.test", timeZone: "UTC", guests: [] };
  it("needs required answers, and sends only this type's own fields", async () => {
    answer = api;
    await expect(createBooking({ ...form, responses: {} })).rejects.toMatchObject({ status: 400 });
    expect(await createBooking({ ...form, responses: { topic: "Hello", injected: "x" } })).toEqual({ uid: "b1", seatUid: "s1" });
    expect((calls.find((c) => c.method === "POST")!.body as { bookingFieldsResponses: object }).bookingFieldsResponses).toEqual({ topic: "Hello" });
  });
  it("carries a number answer in the notes (this Cal refuses it as a field), and leaves blank answers out", async () => {
    types[0].bookingFields!.push({ slug: "count", type: "number", label: "Count", required: false }, { slug: "extra", type: "url", label: "Link", required: false });
    answer = api;
    await createBooking({ ...form, notes: "Hello", responses: { topic: "Hi", count: "7", extra: "" } });
    expect((calls.find((c) => c.method === "POST")!.body as { bookingFieldsResponses: object }).bookingFieldsResponses).toEqual({ topic: "Hi", notes: "Hello\nCount: 7" });
    await expect(createBooking({ ...form, responses: { topic: "Hi", count: "seven" } })).rejects.toThrow(/number for “Count”/);
    types[0].bookingFields!.splice(2);
  });
  it("won't book a hidden type", async () => {
    answer = api;
    await expect(createBooking({ ...form, eventTypeId: 8, responses: {} })).rejects.toMatchObject({ status: 404 });
  });
});
