import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { BookingConfirmation, ManageBooking } from "@/features/cal/booking-ui";
import { calBookingQuery } from "@/features/cal/queries";
import { ErrorBanner } from "@/features/cal/ui";

type Search = { seat?: string; confirmed?: 1; business?: string };

// A private link: rendered only in the browser, so no booking is ever in server HTML or a cache.
export const Route = createFileRoute("/booking/$uid")({
  ssr: false,
  validateSearch: (raw: Record<string, unknown>): Search => ({
    ...(typeof raw.seat === "string" && /^[\w-]{1,64}$/.test(raw.seat) ? { seat: raw.seat } : {}),
    ...(raw.confirmed === 1 || raw.confirmed === "1" ? { confirmed: 1 as const } : {}),
    ...(typeof raw.business === "string" && raw.business ? { business: raw.business.slice(0, 80) } : {}),
  }),
  head: () => ({ meta: [{ title: "Your booking — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: BookingPage,
});

function BookingPage() {
  const { uid } = Route.useParams();
  const { seat, confirmed, business } = Route.useSearch();
  const query = useQuery(calBookingQuery(uid, seat, business));
  const [movedTo, setMovedTo] = React.useState<string | null>(null);
  const missing = query.isError && /wasn.t found/i.test(query.error.message);
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="twc-wrap flex max-w-200 flex-col gap-6 pt-14 pb-24">
          <h1 className="twc-h2">Your booking</h1>
          {missing ? (
            <div className="flex flex-col items-start gap-3">
              <p>We couldn’t find this booking. The link may be incomplete, or the booking may have been moved or cancelled.</p>
              <Link to="/book" className="twc-btn twc-btn--outline twc-btn--sm">Book a time</Link>
            </div>
          ) : query.isError ? <ErrorBanner message="We couldn’t load your booking right now." onRetry={() => void query.refetch()} />
            : !query.data ? <p role="status" className="text-sb-muted">Loading your booking…</p>
            : (
              <>
                {confirmed && query.data.status !== "cancelled" && <BookingConfirmation booking={query.data} />}
                <ManageBooking key={`${query.data.uid}:${query.data.seatUid ?? ""}`} booking={query.data} business={business} moved={movedTo === query.data.uid} onMoved={setMovedTo} onChanged={() => void query.refetch()} />
              </>
            )}
        </div>
      </main>
      <AppFooter />
    </AppPage>
  );
}
