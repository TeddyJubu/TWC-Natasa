// The members' calendar (the canvas's calendar()): its page head naming the month, the ink-ruled month grid with the
// category legend, then that month's program as colour-field rows. The events are the public calendar's (Cal, through
// the same server function /events uses), so nothing here is members-only data; the page is just the members' view
// of it, inside the member frame. The month lives in the URL; without one it opens where the next event is.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppPage } from "@/app/layout/AppLayout";
import { AirShell } from "@/features/account/AirShell";
import { MonthCalendar } from "@/features/cal/calendar";
import { CategoryFilter, EventList } from "@/features/cal/events-ui";
import { openingMonth } from "@/features/cal/event-state";
import { calNextQuery, useGridEvents } from "@/features/cal/queries";
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

function CalendarPage() {
  const { user } = Route.useRouteContext();
  const own = useQuery(profileQuery(user.id)).data;
  const viewer = useQuery(viewerQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // With no month in the address it opens on this month (the collective's own zone, as on /events), or on the next
  // event's month when this one has nothing left; it waits for that answer rather than flash an empty month first.
  const next = useQuery({ ...calNextQuery(), enabled: !search.month });
  const month = search.month ?? (next.isPending ? undefined : openingMonth(monthKey(new Date().toISOString(), "America/New_York"), next.data?.events[0]));
  const { category } = search;
  const cal = useGridEvents(month, { category });
  const events = cal.monthEvents;
  // Her own RSVPs (approved members and admins only): the events she is going to get a tick.
  const canRsvp = viewer.data?.member === true || viewer.data?.admin === true;
  const mine = useQuery({ ...rsvpsQuery(user.id), enabled: canRsvp, retry: false });
  const going = React.useMemo(() => new Set(mine.data ?? []), [mine.data]);
  const [name, year] = React.useMemo(() => {
    if (!month) return [undefined, undefined];
    const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5) - 1, 15));
    return [d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }), month.slice(0, 4)];
  }, [month]);
  const setMonth = (m: string) => void navigate({ search: (prev: CalendarSearch) => ({ ...prev, month: m }), replace: true, resetScroll: false });
  const setCategory = (c?: string) =>
    void navigate({ search: (prev: CalendarSearch) => ({ ...prev, category: c }), replace: true, resetScroll: false });

  return (
    <AppPage trail={false}>
      <AirShell
        page="/calendar" admin={viewer.data?.admin === true} declined={own?.profile.status === "declined"} name={own?.profile.full_name || user.name || user.email}
        avatar={own?.avatarUrl} catalogueNumber={own?.profile.status === "approved" ? own.profile.catalogue_number : null}
      >
        <main id="main" tabIndex={-1} className="outline-none">
          <section className="twc-phd">
            <div>
              <span className="twc-eyebrow">Calendar</span>
              {/* The month is named here once; the grid only announces it as it changes. */}
              <h1>{name ? <>{name}, <i>{year}</i></> : "Calendar"}</h1>
            </div>
          </section>
          <section className="air-sec air-cal">
            {cal.isError && <ErrorBanner message="We couldn’t load the calendar right now." onRetry={() => void cal.refetch()} className="mb-6" />}
            <div className="mb-6"><CategoryFilter categories={cal.data?.categories ?? []} value={category} onChange={setCategory} /></div>
            {month && <MonthCalendar month={month} events={cal.events} onMonthChange={setMonth} going={going} hideTitle />}
            {cal.isPending ? <p role="status" className="mt-8 text-sm text-app-muted">Loading events…</p>
              : events.length > 0 && <div className="mt-10"><h2 className="sr-only">This month’s events</h2><EventList events={events} going={going} /></div>}
          </section>
        </main>
      </AirShell>
    </AppPage>
  );
}
