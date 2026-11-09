// Admin reads (§2.7): server functions that start with requireAdmin.
import { queryOptions } from "@tanstack/react-query";
import {
  adminActionsFn, adminApplicationsFn, adminBookingsFn, adminEventsFn, adminInboxFn, adminLoggedActionsFn,
  adminMembersFn, adminNeighborhoodsFn, adminNewsletterSubscribersFn, adminNotesFn,
} from "./fns";

export type {
  AdminAction, AdminApplication, AdminBooking, AdminEvent, AdminGuest, AdminMember, AdminNeighborhood, AdminNote,
  InboxMessage, LoggedAction, NewsletterSubscriber,
} from "./admin.server";

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

/** Contact messages and partnership inquiries still waiting, newest first. */
export const adminInboxQuery = queryOptions({
  queryKey: ["admin", "inbox"],
  queryFn: () => adminInboxFn(),
});

/** Every admin note (0006), oldest first; rows pick their own by application_id / member_id. */
export const adminNotesQuery = queryOptions({
  queryKey: ["admin", "notes"],
  queryFn: () => adminNotesFn(),
});

/** The newest 100 admin actions (0007): approvals, declines, notes and neighborhood changes, newest first. */
export const adminActionsQuery = queryOptions({
  queryKey: ["admin", "actions"],
  queryFn: () => adminActionsFn(),
});

/** Logged actions done outside the app (0009 / CRM-057): every subject, including soft-removed. */
export const adminLoggedActionsQuery = queryOptions({
  queryKey: ["admin", "logged-actions"],
  queryFn: () => adminLoggedActionsFn(),
});

/** Newsletter sign-ups (CRM-093): newest first; page search filters client-side. */
export const adminNewsletterQuery = queryOptions({
  queryKey: ["admin", "newsletter"],
  queryFn: () => adminNewsletterSubscribersFn(),
});
