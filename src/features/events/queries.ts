import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { bookingFn, eventsFn, plansFn, publicEventsFn, rsvpsFn } from "./fns";
import type { PublicEvent } from "./events.server";

export type { Booking, EventRow, MemberPlan, PublicEvent } from "./events.server";

/** Upcoming events, soonest first (approved members and admins). */
export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => eventsFn({ data: { from: new Date().toISOString() } }),
});

/** Upcoming events for everyone (no RSVPs or member data), soonest first. */
export const publicEventsQuery = queryOptions({
  queryKey: ["public-events"],
  queryFn: () => publicEventsFn({ data: { from: new Date().toISOString() } }),
  // Fresh for a minute, so a page's useQuery does not fetch again what its loader just loaded.
  staleTime: 60_000,
});

/** For the /events loader, so the server renders the calendar: undefined when that fails (the client then loads it). */
export const loadPublicEvents = (queryClient: QueryClient): Promise<PublicEvent[] | undefined> =>
  queryClient.ensureQueryData(publicEventsQuery).catch(() => undefined);

/** Event ids the signed-in member has an RSVP for. */
export const rsvpsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["rsvps", userId],
    queryFn: () => rsvpsFn(),
  });

/**
 * Her Going, Maybe and waitlist answers on upcoming events (/account's Events card and head). Under ["rsvps", userId],
 * so anything that refreshes her RSVPs refreshes these too.
 */
export const plansQuery = (userId: string) =>
  queryOptions({
    queryKey: ["rsvps", userId, "plans"],
    queryFn: () => plansFn(),
  });

/** The member's single headshot booking, or null. */
export const bookingQuery = (userId: string) =>
  queryOptions({
    queryKey: ["booking", userId],
    queryFn: () => bookingFn(),
  });
