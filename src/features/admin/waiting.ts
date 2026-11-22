// What needs an admin's decision right now: the Home page's cards and the sidebar's badges read the same four lists.
import { useQuery } from "@tanstack/react-query";
import type { AdminSection } from "@/app/layout/shell-nav";
import { adminReviewsQuery } from "@/features/member-links/queries";
import { adminApplicationsQuery, adminBookingsQuery, adminInboxQuery } from "./queries";

export function useWaiting() {
  const inbox = useQuery(adminInboxQuery);
  const applications = useQuery(adminApplicationsQuery);
  const reviews = useQuery(adminReviewsQuery);
  const bookings = useQuery(adminBookingsQuery);
  // null until a list has loaded, so "not known yet" never reads as "nothing waiting".
  const counts: Partial<Record<AdminSection, number | null>> = {
    inbox: inbox.data?.filter((m) => m.status === "new").length ?? null,
    applications: applications.data?.filter((a) => a.status === "pending").length ?? null,
    reviews: reviews.data?.length ?? null,
    bookings: bookings.data?.filter((b) => b.status === "requested").length ?? null,
  };
  return { inbox, applications, reviews, bookings, counts };
}
