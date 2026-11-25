import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon } from "@/app/layout/twc";
import { BookingFlow } from "@/features/cal/booking-ui";
import { calEventTypeQuery } from "@/features/cal/queries";
import type { PublicEventType } from "@/features/cal/types";
import { ErrorBanner } from "@/features/cal/ui";

type Search = { business?: string };

export const Route = createFileRoute("/book_/$eventType")({
  validateSearch: (raw: Record<string, unknown>): Search =>
    typeof raw.business === "string" && raw.business ? { business: raw.business.slice(0, 80) } : {},
  loaderDeps: ({ search }) => ({ business: search.business }),
  loader: async ({ context, params, deps }): Promise<PublicEventType | null> => {
    try {
      return await context.queryClient.ensureQueryData(calEventTypeQuery(params.eventType, deps.business));
    } catch (error) {
      if (/wasn.t found/i.test((error as Error).message ?? "")) throw notFound();
      return null;
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Book a time"} — The Women’s Collective` }] }),
  component: BookTypePage,
});

function BookTypePage() {
  const { eventType } = Route.useParams();
  const { business } = Route.useSearch();
  const loaded = Route.useLoaderData();
  const query = useQuery({ ...calEventTypeQuery(eventType, business), initialData: loaded ?? undefined });
  const type = query.data;
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="px-(--twc-gut) py-5">
          <Link to="/book" className="twc-link inline-flex w-fit items-center gap-1.5 font-plex text-xs uppercase tracking-[0.08em]"><Icon name="arrowLeft" className="size-3.5" /> Everything to book</Link>
        </div>
        <section className="twc-phd">
          <div className="min-w-0">
            <p className="twc-eyebrow">Appointments</p>
            <h1 className="twc-display break-words">{type?.title ?? "Book a time"}</h1>
            {type?.description && <p className="twc-lede whitespace-pre-line">{type.description}</p>}
          </div>
        </section>
        <div className="twc-sec">
          {type ? <BookingFlow type={type} business={business} />
            : query.isError ? <ErrorBanner message="We couldn’t load this appointment right now." onRetry={() => void query.refetch()} />
            : <p role="status" className="text-sb-muted">Loading…</p>}
        </div>
      </main>
      <AppFooter />
    </AppPage>
  );
}
