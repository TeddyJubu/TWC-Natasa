// The browser's side of Cal: cached reads, and the posts that keep Cal's error codes for the forms.
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  adminBusinessesFn, adminCalBookingsFn, adminCalEventFn, adminCalEventsFn, adminCalEventTypesFn, adminCalRsvpsFn, calBookingFn,
  calEventFn, calEventsFn, calEventTypeFn, calEventTypesFn, calSlotsFn,
} from "./fns";
import type { BookingStatusFilter, EventTab, RsvpInput, RsvpResult } from "./types";

const FRESH = 60_000;

export type EventsParams = { tab?: EventTab; category?: string; month?: string; skip?: number; take?: number; business?: string };

export const calEventsQuery = (params: EventsParams = {}) =>
  queryOptions({ queryKey: ["cal", "events", params], queryFn: () => calEventsFn({ data: params }), staleTime: FRESH });
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
export function storeRsvp(eventUid: string, email: string, rsvpUid: string) {
  try {
    window.localStorage.setItem(rsvpKey(eventUid, email), rsvpUid);
    window.localStorage.setItem(`twc-rsvp-last:${eventUid}`, JSON.stringify({ email: email.trim().toLowerCase() }));
  } catch {
    // Private windows can refuse; the RSVP itself is saved.
  }
}
/** The email last used on this device for this event, to show their RSVP again. */
export function lastRsvpEmail(eventUid: string): string | undefined {
  try {
    const raw = window.localStorage.getItem(`twc-rsvp-last:${eventUid}`);
    return raw ? (JSON.parse(raw) as { email?: string }).email : undefined;
  } catch {
    return undefined;
  }
}
