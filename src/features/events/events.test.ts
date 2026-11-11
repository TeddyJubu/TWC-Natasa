import { beforeEach, describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { bookingQuery, eventsQuery, loadPublicEvents, publicEventsQuery, rsvpsQuery } from "./queries";
import { bookHeadshot, bookHeadshotMutation, setRsvp, toggleRsvpMutation } from "./mutations";

const run = (q: { queryFn?: unknown }) => (q.queryFn as (c: unknown) => Promise<unknown>)({});
const denied = new Error("Members only.");

beforeEach(() => fake.reset());

describe("eventsQuery", () => {
  it("loads events from now on", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-08T12:00:00Z") });
    const rows = [{ id: "e1" }];
    fake.results = [rows];
    expect(eventsQuery.queryKey).toEqual(["events"]);
    expect(await run(eventsQuery)).toBe(rows);
    expect(fake.calls).toEqual([["eventsFn", { from: "2026-11-08T12:00:00.000Z" }]]);
    vi.useRealTimers();
  });

  it("throws the server's error", async () => {
    fake.results = [denied];
    await expect(run(eventsQuery)).rejects.toBe(denied);
  });
});

describe("publicEventsQuery", () => {
  it("stays fresh after the loader, so the page's query does not fetch again", async () => {
    const qc = new QueryClient();
    fake.results = [[{ id: "e1" }], [{ id: "e1" }]];
    expect(await loadPublicEvents(qc)).toEqual([{ id: "e1" }]);
    const unsubscribe = new QueryObserver(qc, publicEventsQuery).subscribe(() => {});
    await new Promise((r) => setTimeout(r, 10));
    unsubscribe();
    expect(fake.calls.map((c) => c[0])).toEqual(["publicEventsFn"]);
  });
});

describe("rsvpsQuery", () => {
  it("returns the event ids the member is going to", async () => {
    fake.results = [["e1", "e2"]];
    expect(rsvpsQuery("u1").queryKey).toEqual(["rsvps", "u1"]);
    expect(await run(rsvpsQuery("u1"))).toEqual(["e1", "e2"]);
    expect(fake.calls).toEqual([["rsvpsFn"]]);
  });
});

describe("bookingQuery", () => {
  it("returns the member's booking or null", async () => {
    fake.results = [null];
    expect(bookingQuery("u1").queryKey).toEqual(["booking", "u1"]);
    expect(await run(bookingQuery("u1"))).toBeNull();
    expect(fake.calls).toEqual([["bookingFn"]]);
  });
});

describe("setRsvp", () => {
  it.each([true, false])("sends the event and whether she's going (%s)", async (going) => {
    fake.results = [null];
    await setRsvp("u1", "e1", going);
    expect(fake.calls).toEqual([["setRsvpFn", { eventId: "e1", going }]]);
  });

  it("throws the server's error", async () => {
    fake.results = [denied];
    await expect(setRsvp("u1", "e1", true)).rejects.toBe(denied);
  });
});

describe("bookHeadshot", () => {
  const input = { preferred_date: "2026-12-01", preferred_time: "Morning", notes: "n" };

  it("saves the member's single booking and returns it", async () => {
    const saved = { id: "b1", user_id: "u1", ...input, status: "requested" };
    fake.results = [saved];
    expect(await bookHeadshot("u1", input)).toBe(saved);
    expect(fake.calls).toEqual([["bookHeadshotFn", input]]);
  });

  it("trims notes to 300 characters", async () => {
    fake.results = [{}];
    await bookHeadshot("u1", { ...input, notes: "x".repeat(400) });
    expect((fake.calls[0][1] as { notes: string }).notes).toHaveLength(300);
  });
});

describe("event mutation cache effects", () => {
  it("toggling an rsvp invalidates the member's rsvps", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    fake.results = [null];
    await new MutationObserver(qc, toggleRsvpMutation(qc, "u1")).mutate({ eventId: "e1", going: true });
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["rsvps", "u1"]]);
  });

  it("booking writes the saved row into the booking cache", async () => {
    const qc = new QueryClient();
    const saved = { id: "b1" };
    fake.results = [saved];
    await new MutationObserver(qc, bookHeadshotMutation(qc, "u1")).mutate({ preferred_date: "d", preferred_time: "t", notes: "" });
    expect(qc.getQueryData(["booking", "u1"])).toBe(saved);
  });
});
