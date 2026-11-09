// Admin reads (§2.7): server functions that start with requireAdmin.
import { queryOptions } from "@tanstack/react-query";
import { adminApplicationsFn, adminBookingsFn, adminEventsFn, adminMembersFn, adminNeighborhoodsFn } from "./fns";

export type { AdminApplication, AdminBooking, AdminEvent, AdminGuest, AdminMember, AdminNeighborhood } from "./admin.server";

/** Pending first, then newest. */
export const adminApplicationsQuery = queryOptions({
  queryKey: ["admin", "applications"],
  queryFn: () => adminApplicationsFn(),
});

/** Every profile, with the email from her linked application when there is one. Sorted by name. */
export const adminMembersQuery = queryOptions({
  queryKey: ["admin", "members"],
  queryFn: () => adminMembersFn(),
});

/** All neighborhoods, inactive ones included, in display order (logo URLs carry a per-fetch ?v=). */
export const adminNeighborhoodsQuery = queryOptions({
  queryKey: ["admin", "neighborhoods"],
  queryFn: () => adminNeighborhoodsFn(),
});

/** Every headshot booking, soonest preferred date first. */
export const adminBookingsQuery = queryOptions({
  queryKey: ["admin", "bookings"],
  queryFn: () => adminBookingsFn(),
});

/** Every gathering (past ones too), soonest first, each with its guest list. */
export const adminEventsQuery = queryOptions({
  queryKey: ["admin", "events"],
  queryFn: () => adminEventsFn(),
});
