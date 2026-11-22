import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ensureCoverPolicy } from "@/app/cover-pages";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Scallop } from "@/app/layout/twc";
import { jsonLdScript, parseSiteUrl } from "@/app/seo";
import { MonthCalendar } from "@/features/cal/calendar";
import {
  CategoryFilter, EmptyState, EventGrid, EventList, EventsPageHeader, EventsSearch, EventsSkeleton, EventsTabs, EventsViewToggle,
  LoadMore,
} from "@/features/cal/events-ui";
import { parseGatheringsSearch, type GatheringsSearch, type GatheringsView } from "@/features/cal/event-state";
import { calEventsFn } from "@/features/cal/fns";
import { calEventsQuery, type EventsParams } from "@/features/cal/queries";
import { monthKey } from "@/features/cal/time";
import type { EventList as EventPage } from "@/features/cal/types";
import { ErrorBanner } from "@/features/cal/ui";
import { gatheringsLd } from "@/features/events/structured-data";

const TITLE = "Events — The Women’s Collective";
const DESCRIPTION = "Coffee introductions, supper clubs and headshot days. See what’s coming up at The Women’s Collective and RSVP.";
const PAGE_SIZE = 12;
const MONTH_LIMIT = 100;

// The server has no visitor zone, so "this month" starts from the collective's own.
const currentMonth = () => monthKey(new Date().toISOString(), "America/New_York");

function paramsFor(search: GatheringsSearch): EventsParams {
  const shared = { category: search.category, q: search.q, business: search.business };
  return search.view === "calendar"
    ? { ...shared, tab: "all", month: search.month ?? currentMonth(), take: MONTH_LIMIT }
    : { ...shared, tab: search.tab ?? "upcoming", month: search.month, take: PAGE_SIZE };
}

export const Route = createFileRoute("/events")({
  validateSearch: (raw: Record<string, unknown>): GatheringsSearch => parseGatheringsSearch(raw),
  beforeLoad: ({ location, preload }) => ensureCoverPolicy(location.href, preload),
  loaderDeps: ({ search }) => search,
  // The calendar is public, so it is in the server's HTML. If Cal is down the page still renders and says so.
  loader: ({ context, deps }): Promise<EventPage | undefined> =>
    context.queryClient.ensureQueryData(calEventsQuery(paramsFor(deps))).catch(() => undefined),
  head: ({ loaderData }) => {
    const site = parseSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined);
    const ld = site && loaderData ? gatheringsLd(site, loaderData.events) : undefined;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: ld ? [jsonLdScript(ld)] : [],
    };
  },
  component: GatheringsPage,
});

function GatheringsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const view: GatheringsView = search.view ?? "grid";
  const tab = search.tab === "past" ? "past" : "upcoming";
  const params = paramsFor(search);
  const update = (next: Partial<GatheringsSearch>) =>
    void navigate({ search: (prev: GatheringsSearch) => parseGatheringsSearch({ ...prev, ...next }), replace: true, resetScroll: false });

  const calendar = useQuery({ ...calEventsQuery(params), enabled: view === "calendar", initialData: view === "calendar" ? loaded : undefined });
  const list = useInfiniteQuery({
    queryKey: ["cal", "events", "pages", params],
    enabled: view !== "calendar",
    initialPageParam: 0,
    queryFn: ({ pageParam }) => calEventsFn({ data: { ...params, skip: pageParam, take: PAGE_SIZE } }),
    getNextPageParam: (last: EventPage, pages: EventPage[]) => {
      const shown = pages.reduce((n, p) => n + p.events.length, 0);
      return shown < last.total ? shown : undefined;
    },
    initialData: view !== "calendar" && loaded ? { pages: [loaded], pageParams: [0] } : undefined,
    staleTime: 60_000,
  });

  const events = view === "calendar" ? calendar.data?.events ?? [] : list.data?.pages.flatMap((p) => p.events) ?? [];
  const first = view === "calendar" ? calendar.data : list.data?.pages[0];
  const pending = view === "calendar" ? calendar.isPending : list.isPending;
  const error = view === "calendar" ? calendar.isError : list.isError;
  const retry = () => void (view === "calendar" ? calendar.refetch() : list.refetch());
  const filtered = !!(search.category || search.q || search.month);

  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <EventsPageHeader host={first?.host} />
        <section aria-label="Find an event" className="twc-wrap flex flex-col gap-6 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            {view === "calendar" ? <span /> : <EventsTabs tab={tab} onChange={(t) => update({ tab: t === "past" ? "past" : undefined })} />}
            <EventsViewToggle view={view} onChange={(v) => update({ view: v === "grid" ? undefined : v, ...(v === "calendar" ? { tab: undefined } : { month: undefined }) })} />
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <EventsSearch value={search.q} onChange={(q) => update({ q })} />
          </div>
          <CategoryFilter categories={first?.categories ?? []} value={search.category} onChange={(category) => update({ category })} />
        </section>

        <section aria-labelledby="gatherings-results" className="twc-wrap flex flex-col gap-6 pb-26">
          <h2 id="gatherings-results" className="sr-only">{view === "calendar" ? "Calendar" : tab === "past" ? "Past events" : "Upcoming events"}</h2>
          {error && !first ? <ErrorBanner message="We couldn’t load the calendar right now." onRetry={retry} />
            : pending ? <EventsSkeleton />
            : view === "calendar" ? (
              <MonthCalendar month={params.month!} events={events} business={search.business} onMonthChange={(month) => update({ month })} />
            ) : events.length === 0 ? (
              <EmptyState title={filtered ? "Nothing matches that." : tab === "past" ? "No past events yet." : "No events on the calendar yet."}>
                {filtered ? "Try another search or category." : tab === "upcoming" ? "We’ll post the next one here." : null}
              </EmptyState>
            ) : (
              <>
                {view === "list" ? <EventList events={events} business={search.business} /> : <EventGrid events={events} business={search.business} />}
                <LoadMore shown={events.length} total={first?.total ?? 0} busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} />
              </>
            )}
          {list.isFetchNextPageError && <ErrorBanner message="We couldn’t load more events." onRetry={() => void list.fetchNextPage()} />}
        </section>

        <Scallop from="#fcfcfa" to="#edd22e" />
        <section aria-labelledby="host" className="twc-band twc-band--sun pt-18 pb-26">
          <div className="twc-wrap flex max-w-190 flex-col items-center gap-4.5 text-center">
            <h2 id="host" className="twc-h3">Want to host one?</h2>
            <p className="max-w-135 text-[17px]">
              Members host, sponsor and collaborate on events in their own neighborhoods. Tell us what you have in mind.
            </p>
            <Link to="/contact" className="twc-btn mt-2">Pitch an event <span className="twc-arrow" aria-hidden>→</span></Link>
          </div>
        </section>
        <Scallop from="#edd22e" to="#fcfcfa" />
        <div className="h-12" />
      </main>
      <AppFooter />
    </AppPage>
  );
}
