// The browser's side of Cal: cached reads, and the posts that keep Cal's error codes for the forms.
import * as React from "react";
import { queryOptions, useQueries, type QueryClient } from "@tanstack/react-query";
import {
  adminBusinessesFn, adminCalBookingsFn, adminCalEventFn, adminCalEventsFn, adminCalEventTypesFn, adminCalRsvpsFn, adminCalWaitlistFn, calBookingFn,
  calEventFn, calEventsFn, calEventTypeFn, calEventTypesFn, calSlotsFn, memberEventRsvpFn,
} from "./fns";
import { shiftMonth } from "./time";
import type { BookingStatusFilter, EventList, EventTab, RsvpInput, RsvpResult, RsvpStatus } from "./types";

const FRESH = 60_000;

export type EventsParams = { tab?: EventTab | "all"; category?: string; month?: string; q?: string; skip?: number; take?: number; business?: string };

export const calEventsQuery = (params: EventsParams = {}) =>
  queryOptions({ queryKey: ["cal", "events", params], queryFn: () => calEventsFn({ data: params }), staleTime: FRESH });
/** Events in a month, at most, for the month views. */
export const MONTH_LIMIT = 100;
export type MonthFilters = { category?: string; q?: string; business?: string };
/** One month's events (every tab), for the month grids on /events and /calendar. */
export const calMonthQuery = (month: string, filters: MonthFilters = {}) =>
  calEventsQuery({ ...filters, tab: "all", month, take: MONTH_LIMIT });
/** The next upcoming event, the first of the upcoming list: where a month view opens, and whether anything is ahead. */
export const calNextQuery = (business?: string) => calEventsQuery({ tab: "upcoming", take: 1, ...(business ? { business } : {}) });
/** The month and its neighbours: a month grid's leading and trailing days belong to the months either side. */
export const gridMonths = (month: string) => [shiftMonth(month, -1), month, shiftMonth(month, 1)];

/**
 * A month grid's events: its own month's and its neighbours', so the days before the 1st and after the last carry their
 * events too. `month` undefined (still deciding where to open) fetches nothing. A neighbour that fails is only left blank;
 * the month's own failure is the error. `initial` holds a loader's months, keyed by month.
 */
export function useGridEvents(month: string | undefined, filters: MonthFilters, initial?: Readonly<Record<string, EventList>>) {
  const months = month ? gridMonths(month) : [];
  const results = useQueries({ queries: months.map((m) => ({ ...calMonthQuery(m, filters), initialData: initial?.[m] })) });
  const own = results[1];
  const [before, during, after] = [results[0]?.data, own?.data, results[2]?.data];
  const events = React.useMemo(() => {
    const byUid = new Map([before, during, after].flatMap((d) => d?.events ?? []).map((e) => [e.uid, e]));
    return [...byUid.values()].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  }, [before, during, after]);
  return {
    /** Everything on the grid, the neighbours' days included. */
    events,
    /** Only the month's own events, for a list under the grid. */
    monthEvents: own?.data?.events ?? [],
    data: own?.data,
    isPending: !own || own.isPending,
    isError: !!own?.isError,
    refetch: () => results.forEach((r) => void r.refetch()),
  };
}

export const calEventQuery = (slug: string, business?: string) =>
  queryOptions({ queryKey: ["cal", "event", slug, business ?? null], queryFn: () => calEventFn({ data: { slug, business } }), staleTime: FRESH });
export const calEventTypesQuery = (business?: string) =>
  queryOptions({ queryKey: ["cal", "event-types", business ?? null], queryFn: () => calEventTypesFn({ data: { business } }), staleTime: FRESH });
export const calEventTypeQuery = (slug: string, business?: string) =>
  queryOptions({ queryKey: ["cal", "event-type", slug, business ?? null], queryFn: () => calEventTypeFn({ data: { slug, business } }), staleTime: FRESH });
/** Open times change as people book, so these are never served from cache without a refetch. */
export const calSlotsQuery = (input: { eventTypeId: number; start: string; end: string; timeZone: string; bookingUid?: string; business?: string }) =>
  queryOptions({ queryKey: ["cal", "slots", input], queryFn: () => calSlotsFn({ data: input }), staleTime: 0 });
export const calBookingQuery = (uid: string, seat?: string | null, business?: string) =>
  queryOptions({ queryKey: ["cal", "booking", uid, seat ?? null, business ?? null], queryFn: () => calBookingFn({ data: { uid, seat, business } }), retry: false });

export const adminBusinessesQuery = queryOptions({ queryKey: ["cal", "admin", "businesses"], queryFn: () => adminBusinessesFn(), staleTime: FRESH });
export const adminCalEventsQuery = (params: { tab: EventTab; skip: number; take?: number; business?: string }) =>
  queryOptions({ queryKey: ["cal", "admin", "events", params], queryFn: () => adminCalEventsFn({ data: params }) });
export const adminCalEventQuery = (uid: string, business?: string) =>
  queryOptions({ queryKey: ["cal", "admin", "event", uid, business ?? null], queryFn: () => adminCalEventFn({ data: { uid, business } }) });
export const adminCalRsvpsQuery = (uid: string, business?: string) =>
  queryOptions({ queryKey: ["cal", "admin", "rsvps", uid, business ?? null], queryFn: () => adminCalRsvpsFn({ data: { uid, business } }) });
export const adminCalWaitlistQuery = (uid: string) =>
  queryOptions({ queryKey: ["cal", "admin", "waitlist", uid], queryFn: () => adminCalWaitlistFn({ data: { uid } }) });
/** A signed-in member's own answer on the event page. Under ["rsvps"], so every RSVP change refreshes it. */
export const memberEventRsvpQuery = (eventUid: string) =>
  queryOptions({ queryKey: ["rsvps", "event", eventUid], queryFn: () => memberEventRsvpFn({ data: { eventId: eventUid } }) });
export const adminCalBookingsQuery = (params: { status: BookingStatusFilter; skip: number; business?: string }) =>
  queryOptions({ queryKey: ["cal", "admin", "bookings", params], queryFn: () => adminCalBookingsFn({ data: params }) });
export const adminCalEventTypesQuery = (business?: string) =>
  queryOptions({ queryKey: ["cal", "admin", "event-types", business ?? null], queryFn: () => adminCalEventTypesFn({ data: { business } }) });

/** After any change: every Cal read, plus the gatherings cards on /account, /feed and the neighborhood pages. */
export function invalidateCal(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["cal"] }),
    queryClient.invalidateQueries({ queryKey: ["events"] }),
    queryClient.invalidateQueries({ queryKey: ["public-events"] }),
    queryClient.invalidateQueries({ queryKey: ["rsvps"] }),
  ]);
}

/** A refused post: the server's message plus Cal's code. `NETWORK` means it never got an answer. */
export class CalRequestError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function postCal<T>(path: string, body: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  } catch {
    throw new CalRequestError("We couldn’t reach the server. Check your connection and try again.", "NETWORK", 0);
  }
  const data = (await response.json().catch(() => undefined)) as { error?: string; code?: string } | undefined;
  if (!response.ok) throw new CalRequestError(data?.error || "Something went wrong. Please try again.", data?.code ?? "UNAVAILABLE", response.status);
  return data as T;
}

export const sendRsvp = (eventUid: string, input: RsvpInput & { business?: string }) =>
  postCal<RsvpResult>(`/api/gatherings/${encodeURIComponent(eventUid)}/rsvp`, input);
export const joinWaitlist = (eventUid: string, input: { name: string; email: string; business?: string }) =>
  postCal<{ waitlisted: true }>(`/api/gatherings/${encodeURIComponent(eventUid)}/waitlist`, input);
export const sendBooking = (input: object) => postCal<{ uid: string; seatUid: string | null }>("/api/book", input);
export const manageBooking = (uid: string, input: object) =>
  postCal<{ uid: string; seatUid: string | null }>(`/api/booking/${encodeURIComponent(uid)}`, input);

const rsvpKey = (eventUid: string, email: string) => `twc-rsvp:${eventUid}:${email.trim().toLowerCase()}`;

/** The RSVP uid proves "this is me" on a later change. Storage can be blocked, which only means asking again. */
export function storedRsvp(eventUid: string, email: string): string | undefined {
  try {
    return window.localStorage.getItem(rsvpKey(eventUid, email)) ?? undefined;
  } catch {
    return undefined;
  }
}
export type LastRsvp = { email: string; name: string; status: RsvpStatus; plusOnes: number };
export function storeRsvp(eventUid: string, rsvp: LastRsvp, rsvpUid: string) {
  try {
    window.localStorage.setItem(rsvpKey(eventUid, rsvp.email), rsvpUid);
    window.localStorage.setItem(`twc-rsvp-last:${eventUid}`, JSON.stringify({ ...rsvp, email: rsvp.email.trim().toLowerCase() }));
  } catch {
    // Private windows can refuse; the RSVP itself is saved.
  }
}
/** What this device last sent for this event, to show it again. */
export function lastRsvp(eventUid: string): LastRsvp | undefined {
  try {
    const raw = window.localStorage.getItem(`twc-rsvp-last:${eventUid}`);
    const value = raw ? (JSON.parse(raw) as Partial<LastRsvp>) : null;
    return value?.email && value.status ? { email: value.email, name: value.name ?? "", status: value.status, plusOnes: value.plusOnes ?? 0 } : undefined;
  } catch {
    return undefined;
  }
}

/** The email this device put on an event's waitlist, to say so again on the next visit. */
export function waitlistedHere(eventUid: string): string | undefined {
  try {
    return window.localStorage.getItem(`twc-waitlist:${eventUid}`) ?? undefined;
  } catch {
    return undefined;
  }
}
export function rememberWaitlist(eventUid: string, email: string) {
  try {
    window.localStorage.setItem(`twc-waitlist:${eventUid}`, email.trim().toLowerCase());
  } catch {
    // Private windows can refuse; the place itself is saved.
  }
}
