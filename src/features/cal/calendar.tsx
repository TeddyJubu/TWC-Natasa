// The month grid. Each event sits on the day it happens in its own time zone, whoever is looking.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { byEventDay, kindClass } from "./event-state";
import { KindLegend } from "./events-ui";
import { browserTimeZone, dayKey, firstWeekday, formatTime, monthCells, shiftMonth } from "./time";
import type { CalEvent } from "./types";
import { useVisitorLocale } from "./ui";

const MAX_PILLS = 2;
const utc = (day: string) => Date.parse(`${day}T12:00:00Z`);
const addDays = (day: string, by: number) => new Date(utc(day) + by * 86_400_000).toISOString().slice(0, 10);

export function CalendarEventPill({ event, locale, tabbable, business, going }: { event: CalEvent; locale: string; tabbable: boolean; business?: string; going?: boolean }) {
  const time = formatTime({ iso: event.startTime, timeZone: event.timeZone, locale });
  return (
    <Link
      to="/events/$slug" params={{ slug: event.slug }} {...(business ? { search: { business } } : {})} tabIndex={tabbable ? 0 : -1}
      className={cn("twc-e", kindClass(event.category), event.status === "CANCELLED" && "line-through")}
    >
      <span className="sr-only">{event.status === "CANCELLED" ? "Cancelled: " : ""}{going ? "You’re going: " : ""}</span>{going && <span aria-hidden>✓ </span>}{time} {event.title}
    </Link>
  );
}

export function CalendarDayCell({ day, month, events, locale, today, active, onFocusDay, onMore, business, going }: {
  day: string; month: string; events: CalEvent[]; locale: string; today: boolean; active: boolean;
  onFocusDay: (day: string) => void; onMore: (day: string) => void; business?: string; going?: ReadonlySet<string>;
}) {
  const outside = day.slice(0, 7) !== month;
  const label = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(utc(day));
  const count = events.length ? `, ${events.length} ${events.length === 1 ? "event" : "events"}` : "";
  const hidden = events.length - MAX_PILLS;
  return (
    <td
      role="gridcell" data-day={day} tabIndex={active ? 0 : -1} aria-label={`${label}${count}`} aria-current={today ? "date" : undefined}
      onFocus={(e) => { if (e.target === e.currentTarget) onFocusDay(day); }}
      className={cn(outside && "is-outside")}
    >
      <span aria-hidden className={cn("twc-cal__num", today && "is-today")}>
        {Number(day.slice(8))}
      </span>
      <div className="hidden flex-col gap-1 sm:flex">
        {events.slice(0, MAX_PILLS).map((e) => <CalendarEventPill key={e.uid} event={e} locale={locale} tabbable={active} business={business} going={going?.has(e.uid)} />)}
      </div>
      {/* Phones have no room for titles: any day with events opens its list, and the whole cell is the tap target. */}
      {events.length > 0 && (
        <button
          type="button" tabIndex={active ? 0 : -1} onClick={() => onMore(day)}
          className={cn("twc-cal__more after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-sb-ink sm:after:hidden", hidden <= 0 && "sm:hidden")}
        >
          <span className="sm:hidden">{events.length}</span>
          <span className="hidden sm:inline">+{Math.max(hidden, 0)} more</span>
          <span className="sr-only"> on {label}</span>
        </button>
      )}
    </td>
  );
}

/**
 * A WAI-ARIA grid with one tab stop: arrows move by day and week, Home/End to the week's ends, PageUp/PageDown by
 * month. Tab then reaches the focused day's events.
 */
export function MonthCalendar({ month, events, onMonthChange, locale: localeProp, business, going }: {
  month: string; events: CalEvent[]; onMonthChange: (month: string) => void; locale?: string; business?: string;
  /** Uids of the events the signed-in member is going to, marked with a tick. */
  going?: ReadonlySet<string>;
}) {
  const visitor = useVisitorLocale();
  const locale = localeProp ?? visitor;
  const weekStart = firstWeekday(locale);
  const cells = monthCells(month, weekStart);
  const days = byEventDay(events);
  const [today, setToday] = React.useState<string | null>(null);
  React.useEffect(() => setToday(dayKey(new Date().toISOString(), browserTimeZone())), []);
  const [cursor, setCursor] = React.useState(`${month}-01`);
  const [openDay, setOpenDay] = React.useState<string | null>(null);
  const grid = React.useRef<HTMLTableElement>(null);
  const moved = React.useRef<string | null>(null);
  const dayPanel = React.useRef<HTMLHeadingElement>(null);
  const active = cells.includes(cursor) ? cursor : `${month}-01`;

  // The month comes from the URL, a render after the key press, so focus waits until the target day is on screen.
  React.useEffect(() => {
    if (moved.current !== active) return;
    moved.current = null;
    grid.current?.querySelector<HTMLElement>(`[data-day="${active}"]`)?.focus();
  }, [active]);
  React.useEffect(() => { if (openDay) dayPanel.current?.focus(); }, [openDay]);

  const go = (day: string) => {
    moved.current = day;
    if (!day.startsWith(month)) onMonthChange(day.slice(0, 7));
    setCursor(day);
  };
  const shiftKeepingDay = (by: number) => {
    const next = shiftMonth(month, by);
    const last = new Date(Date.UTC(+next.slice(0, 4), +next.slice(5), 0)).getUTCDate();
    go(`${next}-${String(Math.min(+active.slice(8), last)).padStart(2, "0")}`);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).getAttribute("role") !== "gridcell") return;
    const column = (new Date(utc(active)).getUTCDay() - weekStart + 7) % 7;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => go(addDays(active, -1)), ArrowRight: () => go(addDays(active, 1)),
      ArrowUp: () => go(addDays(active, -7)), ArrowDown: () => go(addDays(active, 7)),
      Home: () => go(addDays(active, -column)), End: () => go(addDays(active, 6 - column)),
      PageUp: () => shiftKeepingDay(-1), PageDown: () => shiftKeepingDay(1),
      Enter: () => { if (days.get(active)?.length) setOpenDay(active); },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    move();
  };
  const goToday = () => {
    const now = today ?? dayKey(new Date().toISOString(), browserTimeZone());
    setOpenDay(null);
    onMonthChange(now.slice(0, 7));
    setCursor(now);
  };

  const title = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(utc(`${month}-15`));
  const heads = cells.slice(0, 7).map((d) => ({
    short: new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }).format(utc(d)),
    long: new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long" }).format(utc(d)),
  }));
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const openEvents = openDay ? days.get(openDay) ?? [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 aria-live="polite" className="twc-cal-title">{title}</h3>
        <div className="flex gap-2">
          <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" aria-label="Previous month" onClick={() => { setOpenDay(null); onMonthChange(shiftMonth(month, -1)); }}>‹</button>
          <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={goToday}>Today</button>
          <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" aria-label="Next month" onClick={() => { setOpenDay(null); onMonthChange(shiftMonth(month, 1)); }}>›</button>
        </div>
      </div>
      <table ref={grid} role="grid" aria-label={title} onKeyDown={onKeyDown} className="twc-cal">
        <thead>
          <tr>
            {heads.map((h) => <th key={h.long} scope="col" abbr={h.long}><span aria-hidden>{h.short}</span><span className="sr-only">{h.long}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => (
                <CalendarDayCell
                  key={day} day={day} month={month} events={days.get(day) ?? []} locale={locale} today={day === today} active={day === active}
                  onFocusDay={setCursor} onMore={setOpenDay} business={business} going={going}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <KindLegend events={events} />
      {openDay && (
        <section aria-labelledby="calendar-day" className="flex flex-col gap-2 border border-sb-ink bg-sb-cream p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 id="calendar-day" ref={dayPanel} tabIndex={-1} className="font-display text-[26px] font-extrabold leading-none outline-none [font-stretch:75%]">
              {new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(utc(openDay))}
            </h4>
            <button
              type="button" className="twc-btn twc-btn--outline twc-btn--sm"
              onClick={() => { const day = openDay; setOpenDay(null); grid.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.focus(); }}
            >Close</button>
          </div>
          <ul className="flex flex-col gap-1">
            {openEvents.map((e) => (
              <li key={e.uid}>
                <Link to="/events/$slug" params={{ slug: e.slug }} {...(business ? { search: { business } } : {})} className="twc-link">
                  {going?.has(e.uid) && <span aria-hidden>✓ </span>}{formatTime({ iso: e.startTime, timeZone: e.timeZone, locale })} · {e.title}{e.status === "CANCELLED" ? " (cancelled)" : ""}{going?.has(e.uid) ? " (you’re going)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
