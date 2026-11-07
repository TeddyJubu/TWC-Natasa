import { beforeEach, describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);

import { bookingQuery, eventsQuery, rsvpsQuery } from "./queries";
import { bookHeadshot, bookHeadshotMutation, setRsvp, toggleRsvpMutation } from "./mutations";

const run = (q: { queryFn?: unknown }) => (q.queryFn as (c: unknown) => Promise<unknown>)({});
const dbError = { code: "42501", message: "permission denied" };

beforeEach(() => fake.reset());

describe("eventsQuery", () => {
  it("loads upcoming events in start order", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-08T12:00:00Z") });
    const rows = [{ id: "e1" }];
    fake.results = [{ data: rows, error: null }];
    expect(eventsQuery.queryKey).toEqual(["events"]);
    expect(await run(eventsQuery)).toBe(rows);
    expect(fake.calls).toEqual([
      ["from", "events"], ["select", "*"], ["gte", "starts_at", "2026-11-08T12:00:00.000Z"], ["order", "starts_at"],
    ]);
    vi.useRealTimers();
  });

  it("throws the query error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(run(eventsQuery)).rejects.toBe(dbError);
  });
});

describe("rsvpsQuery", () => {
  it("returns the event ids the member is going to", async () => {
    fake.results = [{ data: [{ event_id: "e1" }, { event_id: "e2" }], error: null }];
    expect(rsvpsQuery("u1").queryKey).toEqual(["rsvps", "u1"]);
    expect(await run(rsvpsQuery("u1"))).toEqual(["e1", "e2"]);
    expect(fake.calls).toEqual([["from", "event_rsvps"], ["select", "event_id"]]);
  });

  it("throws the query error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(run(rsvpsQuery("u1"))).rejects.toBe(dbError);
  });
});

describe("bookingQuery", () => {
  it("returns the member's booking or null", async () => {
    fake.results = [{ data: null, error: null }];
    expect(bookingQuery("u1").queryKey).toEqual(["booking", "u1"]);
    expect(await run(bookingQuery("u1"))).toBeNull();
    expect(fake.calls).toEqual([["from", "headshot_bookings"], ["select", "*"], ["eq", "user_id", "u1"], ["maybeSingle"]]);
  });

  it("throws the query error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(run(bookingQuery("u1"))).rejects.toBe(dbError);
  });
});

describe("setRsvp", () => {
  it("inserts an rsvp when going", async () => {
    fake.results = [{ data: null, error: null }];
    await setRsvp("u1", "e1", true);
    expect(fake.calls).toEqual([["from", "event_rsvps"], ["insert", { event_id: "e1", user_id: "u1" }]]);
  });

  it("deletes the member's rsvp when not going", async () => {
    fake.results = [{ data: null, error: null }];
    await setRsvp("u1", "e1", false);
    expect(fake.calls).toEqual([["from", "event_rsvps"], ["delete"], ["eq", "event_id", "e1"], ["eq", "user_id", "u1"]]);
  });

  it.each([true, false])("throws the write error (going=%s)", async (going) => {
    fake.results = [{ data: null, error: dbError }];
    await expect(setRsvp("u1", "e1", going)).rejects.toBe(dbError);
  });
});

describe("bookHeadshot", () => {
  const input = { preferred_date: "2026-12-01", preferred_time: "Morning", notes: "n" };

  it("upserts the member's single booking and returns it", async () => {
    const saved = { id: "b1", user_id: "u1", ...input };
    fake.results = [{ data: saved, error: null }];
    expect(await bookHeadshot("u1", input)).toBe(saved);
    expect(fake.calls).toEqual([
      ["from", "headshot_bookings"], ["upsert", { user_id: "u1", ...input }, { onConflict: "user_id" }], ["select"], ["single"],
    ]);
  });

  it("trims notes to 300 characters", async () => {
    fake.results = [{ data: {}, error: null }];
    await bookHeadshot("u1", { ...input, notes: "x".repeat(400) });
    expect((fake.calls[1][1] as { notes: string }).notes).toHaveLength(300);
  });

  it("throws the write error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(bookHeadshot("u1", input)).rejects.toBe(dbError);
  });
});

describe("event mutation cache effects", () => {
  it("toggling an rsvp invalidates the member's rsvps", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    fake.results = [{ data: null, error: null }];
    await new MutationObserver(qc, toggleRsvpMutation(qc, "u1")).mutate({ eventId: "e1", going: true });
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["rsvps", "u1"]]);
  });

  it("booking writes the saved row into the booking cache", async () => {
    const qc = new QueryClient();
    const saved = { id: "b1" };
    fake.results = [{ data: saved, error: null }];
    await new MutationObserver(qc, bookHeadshotMutation(qc, "u1")).mutate({ preferred_date: "d", preferred_time: "t", notes: "" });
    expect(qc.getQueryData(["booking", "u1"])).toBe(saved);
  });
});
