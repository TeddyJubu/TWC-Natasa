import { queryOptions } from "@tanstack/react-query";
import { bookingFn, eventsFn, publicEventsFn, rsvpsFn } from "./fns";

export type { Booking, EventRow, PublicEvent } from "./events.server";

/** Upcoming events, soonest first (approved members and admins). */
export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => eventsFn({ data: { from: new Date().toISOString() } }),
});

/** Upcoming gatherings for everyone (no RSVPs or member data), soonest first. */
export const publicEventsQuery = queryOptions({
  queryKey: ["public-events"],
  queryFn: () => publicEventsFn({ data: { from: new Date().toISOString() } }),
});

/** Event ids the signed-in member has an RSVP for. */
export const rsvpsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["rsvps", userId],
    queryFn: () => rsvpsFn(),
  });

/** The member's single headshot booking, or null. */
export const bookingQuery = (userId: string) =>
  queryOptions({
    queryKey: ["booking", userId],
    queryFn: () => bookingFn(),
  });
