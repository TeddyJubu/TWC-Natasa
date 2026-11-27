// The members' calendar (the canvas's calendar()): its page head naming the month, the ink-ruled month grid with the
// category legend, then that month's program as colour-field rows. The events are the public calendar's (Cal, through
// the same server function /events uses), so nothing here is members-only data; the page is just the members' view
// of it, inside the member frame. The month lives in the URL.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppPage } from "@/app/layout/AppLayout";
import { AirShell } from "@/features/account/AirShell";
import { MonthCalendar } from "@/features/cal/calendar";
import { CategoryFilter, EventList } from "@/features/cal/events-ui";
import { calEventsQuery } from "@/features/cal/queries";
import { monthKey } from "@/features/cal/time";
import { ErrorBanner } from "@/features/cal/ui";
import { rsvpsQuery } from "@/features/events/queries";
import { profileQuery, viewerQuery } from "@/features/members/queries";

type CalendarSearch = { month?: string; category?: string };
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (raw: Record<string, unknown>): CalendarSearch => ({
    ...(typeof raw.month === "string" && MONTH.test(raw.month) ? { month: raw.month } : {}),
    ...(typeof raw.category === "string" && raw.category.trim() ? { category: raw.category.trim().slice(0, 80) } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Calendar — The Women’s Collective" },
      { name: "description", content: "The month’s events across North Brooklyn and Queens." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});

/** Events in a month, at most: the same cap /events uses. */
const MONTH_LIMIT = 100;

function CalendarPage() {
  const { user } = Route.useRouteContext();
  const own = useQuery(profileQuery(user.id)).data;
  const viewer = useQuery(viewerQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // The collective's own zone decides "this month", as on /events.
  const month = search.month ?? monthKey(new Date().toISOString(), "America/New_York");
  const { category } = search;
  const cal = useQuery(calEventsQuery({ tab: "all", month, category, take: MONTH_LIMIT }));
  const events = cal.data?.events ?? [];
  // Her own RSVPs (approved members and admins only): the events she is going to get a tick.
  const canRsvp = viewer.data?.member === true || viewer.data?.admin === true;
  const mine = useQuery({ ...rsvpsQuery(user.id), enabled: canRsvp, retry: false });
  const going = React.useMemo(() => new Set(mine.data ?? []), [mine.data]);
  const [name, year] = React.useMemo(() => {
    const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5) - 1, 15));
    return [d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }), month.slice(0, 4)];
  }, [month]);
  const setMonth = (m: string) => void navigate({ search: (prev: CalendarSearch) => ({ ...prev, month: m }), replace: true, resetScroll: false });
  const setCategory = (c?: string) =>
    void navigate({ search: (prev: CalendarSearch) => ({ ...prev, category: c }), replace: true, resetScroll: false });

  return (
    <AppPage trail={false}>
      <AirShell
        page="/calendar" admin={viewer.data?.admin === true} name={own?.profile.full_name || user.name || user.email}
        avatar={own?.avatarUrl} catalogueNumber={own?.profile.status === "approved" ? own.profile.catalogue_number : null}
      >
        <main id="main" tabIndex={-1} className="outline-none">
          <section className="twc-phd">
            <div>
              <span className="twc-eyebrow">Calendar</span>
              <h1>{name}, <i>{year}</i></h1>
            </div>
          </section>
          <section className="air-sec air-cal">
            {cal.isError && <ErrorBanner message="We couldn’t load the calendar right now." onRetry={() => void cal.refetch()} className="mb-6" />}
            <div className="mb-6"><CategoryFilter categories={cal.data?.categories ?? []} value={category} onChange={setCategory} /></div>
            <MonthCalendar month={month} events={events} onMonthChange={setMonth} going={going} />
            {cal.isPending ? <p role="status" className="mt-8 text-sm text-app-muted">Loading events…</p>
              : events.length > 0 && <div className="mt-10"><h2 className="sr-only">This month’s events</h2><EventList events={events} going={going} /></div>}
          </section>
        </main>
      </AirShell>
    </AppPage>
  );
}
