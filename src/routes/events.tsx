import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { jsonLdScript, parseSiteUrl } from "@/app/seo";
import { MonthCalendar } from "@/features/cal/calendar";
import {
  CategoryFilter, EmptyState, EventList, EventsSearch, EventsSkeleton, EventsTabs, EventsViewToggle, LoadMore,
} from "@/features/cal/events-ui";
import { Experiences } from "@/app/canvas/Experiences";
import { Icon } from "@/app/layout/twc";
import { openingMonth, parseGatheringsSearch, type GatheringsSearch, type GatheringsView } from "@/features/cal/event-state";
import { calEventsFn } from "@/features/cal/fns";
import { calEventsQuery, calMonthQuery, calNextQuery, gridMonths, useGridEvents, type EventsParams, type MonthFilters } from "@/features/cal/queries";
import { monthKey } from "@/features/cal/time";
import type { EventList as EventPage } from "@/features/cal/types";
import { ErrorBanner } from "@/features/cal/ui";
import { gatheringsLd } from "@/features/events/structured-data";
import { NewsletterSignup } from "@/features/newsletter/NewsletterSignup";

const TITLE = "Events — The Women’s Collective";
const DESCRIPTION = "Coffee introductions, supper clubs and headshot days. See what’s coming up at The Women’s Collective and RSVP.";
const PAGE_SIZE = 12;

// The server has no visitor zone, so "this month" starts from the collective's own.
const currentMonth = () => monthKey(new Date().toISOString(), "America/New_York");

const filtersOf = (search: GatheringsSearch): MonthFilters => ({ category: search.category, q: search.q, business: search.business });
const listParams = (search: GatheringsSearch): EventsParams =>
  ({ ...filtersOf(search), tab: search.tab ?? "upcoming", month: search.month, take: PAGE_SIZE });

/**
 * What the server's HTML is built from: the next upcoming event (does anything lie ahead, and where the calendar opens),
 * then either the list's first page or the calendar's month with its neighbours (the grid's outside days).
 */
export type EventsLoad = { next?: EventPage; page?: EventPage; month?: string; months?: Record<string, EventPage> };

const monthName = (month: string, withYear = false) =>
  new Date(Date.UTC(+month.slice(0, 4), +month.slice(5) - 1, 15))
    .toLocaleDateString("en-US", { month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

export const Route = createFileRoute("/events")({
  validateSearch: (raw: Record<string, unknown>): GatheringsSearch => parseGatheringsSearch(raw),
  loaderDeps: ({ search }) => search,
  // The calendar is public, so it is in the server's HTML. If Cal is down the page still renders and says so.
  loader: async ({ context, deps }): Promise<EventsLoad> => {
    const q = context.queryClient;
    const soft = <T,>(p: Promise<T>) => p.catch(() => undefined);
    if (deps.view !== "calendar") {
      const [next, page] = await Promise.all([soft(q.ensureQueryData(calNextQuery(deps.business))), soft(q.ensureQueryData(calEventsQuery(listParams(deps))))]);
      return { next, page };
    }
    const next = await soft(q.ensureQueryData(calNextQuery(deps.business)));
    const month = deps.month ?? openingMonth(currentMonth(), next?.events[0]);
    const loaded = await Promise.all(gridMonths(month).map(async (m) => [m, await soft(q.ensureQueryData(calMonthQuery(m, filtersOf(deps))))] as const));
    return { next, month, months: Object.fromEntries(loaded.filter((entry): entry is readonly [string, EventPage] => !!entry[1])) };
  },
  head: ({ loaderData }) => {
    const site = parseSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined);
    const shown = loaderData?.page?.events ?? (loaderData?.month ? loaderData.months?.[loaderData.month]?.events : undefined);
    const ld = site && shown ? gatheringsLd(site, shown) : undefined;
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
  const calendarView = view === "calendar";
  const tab = search.tab === "past" ? "past" : "upcoming";
  const params = listParams(search);
  const update = (next: Partial<GatheringsSearch>) =>
    void navigate({ search: (prev: GatheringsSearch) => parseGatheringsSearch({ ...prev, ...next }), replace: true, resetScroll: false });

  // The first upcoming event, unfiltered: whether anything lies ahead, and the month the calendar opens on.
  const next = useQuery({ ...calNextQuery(search.business), initialData: loaded?.next });
  const month = calendarView ? search.month ?? (next.isPending ? undefined : openingMonth(currentMonth(), next.data?.events[0])) : undefined;
  const grid = useGridEvents(month, filtersOf(search), loaded?.months);
  const list = useInfiniteQuery({
    queryKey: ["cal", "events", "pages", params],
    enabled: !calendarView,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => calEventsFn({ data: { ...params, skip: pageParam, take: PAGE_SIZE } }),
    getNextPageParam: (last: EventPage, pages: EventPage[]) => {
      const shown = pages.reduce((n, p) => n + p.events.length, 0);
      return shown < last.total ? shown : undefined;
    },
    initialData: !calendarView && loaded?.page ? { pages: [loaded.page], pageParams: [0] } : undefined,
    staleTime: 60_000,
  });

  const events = calendarView ? grid.events : list.data?.pages.flatMap((p) => p.events) ?? [];
  const first = calendarView ? grid.data : list.data?.pages[0];
  const pending = calendarView ? grid.isPending : list.isPending;
  const error = calendarView ? grid.isError : list.isError;
  const retry = () => void (calendarView ? grid.refetch() : list.refetch());
  const searching = !!(search.category || search.q);
  // Nothing at all lies ahead (the live calendar's usual state today): there is nothing to search, filter or lay out
  // on a calendar, so the upcoming list is only its tabs and the letter that brings the next date.
  const bare = !calendarView && tab === "upcoming" && next.data?.total === 0;

  // The head says what is on screen: the calendar's month, the past, a search's count, or the program's first month.
  const firstEvent = !calendarView && tab === "upcoming" && !searching ? events[0] : undefined;
  const programMonth = firstEvent ? monthKey(firstEvent.startTime, firstEvent.timeZone) : undefined;
  const title = calendarView ? (month ? <>Program, <i>{monthName(month)}</i></> : "Program")
    : tab === "past" ? <>Past <i>events</i></>
    : programMonth ? <>Program, <i>{monthName(programMonth)}</i></>
    : searching ? "Program"
    : <>Upcoming <i>events</i></>;
  const meta: [string, string] | null = calendarView ? (month ? ["Month", monthName(month, true)] : null)
    : searching ? (first ? ["Found", first.total === 1 ? "1 event" : `${first.total} events`] : null)
    : tab === "past" ? ["Order", "Most recent first"]
    : ["Month", programMonth ? monthName(programMonth, true) : "New dates posted as they’re announced"];
  const clearSearch = () => update({ q: undefined, category: undefined, month: undefined });

  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="program-title" className="twc-sec flex flex-col gap-6">
          <div className="twc-shead twc-shead--meta mb-0">
            <h1 id="program-title" className="twc-h2">{title}</h1>
            <p className="twc-meta">{meta && <>{meta[0]}<br />{meta[1]}</>}</p>
            <p className="twc-meta">Members<br />Zooms, coffees and happy hours included</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            {calendarView ? <span /> : <EventsTabs tab={tab} onChange={(t) => update({ tab: t === "past" ? "past" : undefined })} />}
            {!bare && <EventsViewToggle view={view} onChange={(v) => update({ view: v === "grid" ? undefined : v, ...(v === "calendar" ? { tab: undefined } : { month: undefined }) })} />}
          </div>
          {!bare && (
            <>
              <div className="flex flex-wrap items-end gap-6">
                <EventsSearch value={search.q} onChange={(q) => update({ q })} />
              </div>
              <CategoryFilter categories={first?.categories ?? []} value={search.category} onChange={(category) => update({ category })} />
            </>
          )}
        </section>

        <section aria-labelledby="gatherings-results" className="flex flex-col gap-6 px-(--twc-gut) pb-15">
          <h2 id="gatherings-results" className="sr-only">{calendarView ? "Calendar" : tab === "past" ? "Past events" : "Upcoming events"}</h2>
          {error && !first ? <ErrorBanner message="We couldn’t load the calendar right now." onRetry={retry} />
            : bare ? (
              <EmptyState title="No events on the calendar yet.">
                <p>Get the letter and hear about the next date first.</p>
                <NewsletterSignup className="mt-5 max-w-[440px]" />
              </EmptyState>
            )
            : pending ? <EventsSkeleton />
            : calendarView ? (
              <MonthCalendar month={month!} events={events} business={search.business} onMonthChange={(m) => update({ month: m })} hideTitle />
            ) : events.length === 0 ? (
              searching || search.month ? (
                <EmptyState title="Nothing matches that.">
                  <p>Try another search or category.</p>
                  <button type="button" className="twc-btn twc-btn--outline twc-btn--sm mt-4" onClick={clearSearch}>Clear search</button>
                </EmptyState>
              ) : (
                <EmptyState title={tab === "past" ? "No past events yet." : "No events on the calendar yet."}>
                  {tab === "upcoming" ? "We’ll post the next one here." : null}
                </EmptyState>
              )
            ) : (
              <>
                <EventList events={events} business={search.business} />
                <LoadMore shown={events.length} total={first?.total ?? 0} busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} />
              </>
            )}
          {list.isFetchNextPageError && <ErrorBanner message="We couldn’t load more events." onRetry={() => void list.fetchNextPage()} />}
        </section>

        <section className="twc-duo" aria-label="Guests and hosts">
          <div className="twc-panel twc-panel--short twc-c-ev-mint">
            <h2>Bring a <i>guest</i></h2>
            <p className="copy">Members can invite a friend to her first Coffee Connection or Happy Hour, free with an RSVP. After that she can join, or buy a ticket to an event that’s open to guests.</p>
            <Link to="/membership" className="twc-btn self-start">See membership <Icon name="arrow" className="twc-arrow" /></Link>
          </div>
          <div className="twc-panel twc-panel--short twc-c-lilac">
            <h2 id="host">Host <i>one</i></h2>
            <p className="copy">Have a space or a skill to share? Co-create a coffee, panel or workshop with us.</p>
            <Link to="/partnerships" className="twc-btn twc-btn--outline self-start">Partner with us <Icon name="arrow" className="twc-arrow" /></Link>
          </div>
        </section>

        {/* What the program is made of: below the dates, so the first event is the first thing on the page. */}
        <Experiences heading="h2" />
      </main>
      <AppFooter />
    </AppPage>
  );
}
