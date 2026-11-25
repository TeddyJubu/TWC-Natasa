import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { EventTypeList } from "@/features/cal/booking-ui";
import { calEventTypesQuery } from "@/features/cal/queries";
import type { PublicEventType } from "@/features/cal/types";
import { ErrorBanner } from "@/features/cal/ui";

const TITLE = "Book a time — The Women’s Collective";
type Search = { business?: string };

export const Route = createFileRoute("/book")({
  validateSearch: (raw: Record<string, unknown>): Search =>
    typeof raw.business === "string" && raw.business ? { business: raw.business.slice(0, 80) } : {},
  loaderDeps: ({ search }) => ({ business: search.business }),
  loader: ({ context, deps }): Promise<PublicEventType[] | undefined> =>
    context.queryClient.ensureQueryData(calEventTypesQuery(deps.business)).catch(() => undefined),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: "Book a time with The Women’s Collective." }, { property: "og:title", content: TITLE }] }),
  component: BookPage,
});

function BookPage() {
  const { business } = Route.useSearch();
  const query = useQuery({ ...calEventTypesQuery(business), initialData: Route.useLoaderData() });
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-phd">
          <div className="min-w-0">
            <p className="twc-eyebrow">Appointments</p>
            <h1 className="twc-display">Book a time.</h1>
            <p className="twc-lede">Choose what you’d like to book, then pick a time that works for you.</p>
          </div>
        </section>
        <section aria-label="What you can book" className="twc-sec">
          {query.data ? <EventTypeList types={query.data} business={business} />
            : query.isError ? <ErrorBanner message="We couldn’t load the appointments right now." onRetry={() => void query.refetch()} />
            : <p role="status" className="text-sb-muted">Loading…</p>}
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
