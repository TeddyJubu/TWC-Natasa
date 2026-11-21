// The public gatherings pages' pieces, on the scrapbook kit. Everything here renders the allowlisted `CalEvent`.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { Icon } from "@/app/layout/twc";
import { isEnded, isFull, type GatheringsView } from "./event-state";
import type { CalEvent } from "./types";
import { CancelledBadge, CategoryChip, DateTimeText, EndedBadge, StatusBadge, useToast, useVisitorLocale } from "./ui";

export function EventStatus({ event }: { event: CalEvent }) {
  if (event.status === "CANCELLED") return <CancelledBadge />;
  if (isEnded(event)) return <EndedBadge />;
  if (isFull(event)) return <StatusBadge kind="full" />;
  return null;
}

export function EventsPageHeader({ host }: { host?: string | null }) {
  return (
    <section className="twc-wrap flex flex-col gap-5 pt-18 pb-10">
      <p className="twc-eyebrow-script">gatherings</p>
      <h1 className="twc-display">Show up locally.</h1>
      <p className="twc-lede max-w-160">
        Coffee introductions, supper clubs and headshot days{host ? ` with ${host}` : ""}. See what’s coming up and tell us you’re coming.
      </p>
    </section>
  );
}

const pressable = "twc-choice aria-pressed:bg-sb-ink aria-pressed:text-sb-paper aria-pressed:shadow-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sb-blue-ink";

export function EventsTabs({ tab, onChange }: { tab: "upcoming" | "past"; onChange: (tab: "upcoming" | "past") => void }) {
  return (
    <div role="group" aria-label="Which gatherings" className="flex flex-wrap gap-2">
      {(["upcoming", "past"] as const).map((t) => (
        <button key={t} type="button" aria-pressed={tab === t} className={pressable} onClick={() => onChange(t)}>
          {t === "upcoming" ? "Upcoming" : "Past"}
        </button>
      ))}
    </div>
  );
}

export function EventsViewToggle({ view, onChange }: { view: GatheringsView; onChange: (view: GatheringsView) => void }) {
  return (
    <div role="group" aria-label="View as" className="flex flex-wrap gap-2">
      {(["grid", "list", "calendar"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} className={pressable} onClick={() => onChange(v)}>
          {v === "grid" ? "Grid" : v === "list" ? "List" : "Calendar"}
        </button>
      ))}
    </div>
  );
}

export function CategoryFilter({ categories, value, onChange }: { categories: string[]; value?: string; onChange: (category?: string) => void }) {
  const id = React.useId();
  if (!categories.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <span id={id} className="twc-eyebrow text-sb-ink">Browse by category</span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={!value} className={pressable} onClick={() => onChange(undefined)}>All</button>
        {categories.map((c) => (
          <button key={c} type="button" aria-pressed={value === c} className={pressable} onClick={() => onChange(c)}>{c}</button>
        ))}
      </div>
    </div>
  );
}

/** Writes to the URL a moment after typing stops, so each keystroke doesn't fetch. */
export function EventsSearch({ value, onChange }: { value?: string; onChange: (q?: string) => void }) {
  const [text, setText] = React.useState(value ?? "");
  const latest = React.useRef(onChange);
  React.useEffect(() => { latest.current = onChange; });
  React.useEffect(() => { setText(value ?? ""); }, [value]);
  React.useEffect(() => {
    if (text.trim() === (value ?? "")) return undefined;
    const timer = setTimeout(() => latest.current(text.trim() || undefined), 300);
    return () => clearTimeout(timer);
  }, [text, value]);
  return (
    <div className="twc-field max-w-90 flex-1">
      <label htmlFor="gatherings-search">Search</label>
      <input
        id="gatherings-search" type="search" className="twc-input" value={text} maxLength={100}
        placeholder="Title, place or category" onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}

/** Only https covers: the page's CSP blocks anything else. A broken link falls back to the date tile. */
export function CoverImage({ event, className }: { event: Pick<CalEvent, "coverImageUrl">; className?: string }) {
  const [broken, setBroken] = React.useState(false);
  if (!event.coverImageUrl?.startsWith("https://") || broken) return null;
  return <img src={event.coverImageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("object-cover", className)} onError={() => setBroken(true)} />;
}

function DateTile({ event, className }: { event: CalEvent; className?: string }) {
  const locale = useVisitorLocale();
  const at = Date.parse(event.startTime);
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: event.timeZone, ...options }).format(at);
  return (
    <div aria-hidden className={cn("flex flex-col items-center justify-center gap-1 bg-sb-sun text-center text-sb-ink", className)}>
      <span className="font-fragment text-xs tracking-[2px] uppercase">{part({ month: "short" })}</span>
      <span className="font-display text-[40px] leading-none">{part({ day: "numeric" })}</span>
    </div>
  );
}

const eventLink = (event: CalEvent, business?: string) => ({
  to: "/gatherings/$slug" as const, params: { slug: event.slug }, ...(business ? { search: { business } } : {}),
});

export function EventCard({ event, business }: { event: CalEvent; business?: string }) {
  const hasCover = !!event.coverImageUrl?.startsWith("https://");
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-md border border-sb-ink/15 bg-sb-paper">
      {hasCover ? <CoverImage event={event} className="aspect-[16/9] w-full" /> : <DateTile event={event} className="aspect-[16/9] w-full" />}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {event.category && <CategoryChip category={event.category} />}
          <EventStatus event={event} />
        </div>
        <h3 className="font-display text-[24px]/[1.25] break-words">
          <Link {...eventLink(event, business)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sb-blue-ink">
            {event.title}
          </Link>
        </h3>
        <EventDateTime event={event} />
        {event.location && <EventLocation location={event.location} />}
      </div>
    </article>
  );
}

export function EventGrid({ events, business }: { events: CalEvent[]; business?: string }) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => <li key={e.uid}><EventCard event={e} business={business} /></li>)}
    </ul>
  );
}

export function EventList({ events, business }: { events: CalEvent[]; business?: string }) {
  return (
    <ol>
      {events.map((e) => (
        <li key={e.uid} className="relative flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-sb-ink/15 py-6 first:border-t">
          <DateTile event={e} className="h-24 w-24 flex-none rounded-md" />
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {e.category && <CategoryChip category={e.category} />}
              <EventStatus event={e} />
            </div>
            <h3 className="font-display text-[24px]/[1.25] break-words">
              <Link {...eventLink(e, business)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sb-blue-ink">
                {e.title}
              </Link>
            </h3>
            <EventDateTime event={e} />
            {e.location && <EventLocation location={e.location} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md bg-sb-cream px-6 py-8">
      <p className="font-display text-2xl">{title}</p>
      {children && <div className="text-sb-ink">{children}</div>}
    </div>
  );
}

export function EventsSkeleton() {
  return (
    <div role="status" aria-label="Loading gatherings" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-md bg-sb-ink/8 motion-safe:animate-pulse" />)}
    </div>
  );
}

export function LoadMore({ onClick, busy, shown, total }: { onClick: () => void; busy: boolean; shown: number; total: number }) {
  if (shown >= total) return null;
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <p className="text-sm text-sb-muted">Showing {shown} of {total}</p>
      <button type="button" className="twc-btn twc-btn--outline" disabled={busy} onClick={onClick}>{busy ? "Loading…" : "Show more"}</button>
    </div>
  );
}

/** The next few gatherings, for /embed/gatherings. Links open the site in a new tab, out of the frame. */
export function EventsWidget({ events }: { events: CalEvent[] }) {
  if (!events.length) return <p className="text-sb-muted">No gatherings on the calendar yet.</p>;
  return (
    <ul className="flex flex-col">
      {events.map((e) => (
        <li key={e.uid} className="flex flex-col gap-1 border-b border-sb-ink/15 py-3 last:border-0">
          <a href={`/gatherings/${encodeURIComponent(e.slug)}`} target="_blank" rel="noopener" className="twc-link font-display text-xl">
            {e.title}<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <EventDateTime event={e} />
        </li>
      ))}
    </ul>
  );
}

export function EventHero({ event }: { event: CalEvent }) {
  return (
    <header className="twc-wrap flex flex-col gap-5 pt-14 pb-8">
      <Link to="/gatherings" className="twc-link inline-flex w-fit items-center gap-1.5 text-sm">
        <Icon name="arrowLeft" className="size-3.5" /> All gatherings
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {event.category && <CategoryChip category={event.category} />}
        <EventStatus event={event} />
      </div>
      <h1 className="twc-display break-words">{event.title}</h1>
      <CoverImage event={event} className="max-h-[440px] w-full rounded-md" />
    </header>
  );
}

export function EventDateTime({ event, className }: { event: Pick<CalEvent, "startTime" | "endTime" | "timeZone">; className?: string }) {
  return (
    <span className={cn("inline-flex items-start gap-1.5 text-sm", className)}>
      <Icon name="clock" className="mt-0.5 size-3.5 flex-none" />
      <DateTimeText iso={event.startTime} end={event.endTime} timeZone={event.timeZone} />
    </span>
  );
}

export function EventLocation({ location }: { location: string }) {
  return <span className="inline-flex items-start gap-1.5 text-sm break-words"><Icon name="pin" className="mt-0.5 size-3.5 flex-none" />{location}</span>;
}

/** Plain text, always: line breaks are kept and nothing is parsed as markup. */
export function EventDescription({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-[17px]/[1.65] break-words whitespace-pre-line">{text}</p>;
}

export function HostCard({ host }: { host: CalEvent["host"] }) {
  if (!host.name) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="twc-eyebrow text-sb-ink">Hosted by</span>
      <span className="font-display text-xl">{host.name}</span>
    </div>
  );
}

export function CapacityBar({ event }: { event: Pick<CalEvent, "capacity" | "spotsLeft"> }) {
  if (event.capacity === null) return null;
  const left = Math.max(event.spotsLeft ?? 0, 0);
  const taken = Math.min(event.capacity - left, event.capacity);
  return (
    <div className="flex flex-col gap-1.5">
      <progress className="h-2 w-full appearance-none overflow-hidden rounded-full bg-sb-ink/15 [&::-moz-progress-bar]:bg-sb-ink [&::-webkit-progress-bar]:bg-sb-ink/15 [&::-webkit-progress-value]:bg-sb-ink" max={event.capacity} value={taken} aria-label="Spots taken">{taken} of {event.capacity}</progress>
      <span className="text-sm">{left === 0 ? "No spots left" : `${left} of ${event.capacity} spots left`}</span>
    </div>
  );
}

export function AttendanceSummary({ event }: { event: CalEvent }) {
  return (
    <p className="text-sm">
      <strong className="font-medium">{event.goingCount}</strong> going
      {event.maybeCount > 0 && <> · <strong className="font-medium">{event.maybeCount}</strong> maybe</>}
    </p>
  );
}

export function AttendeeList({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="twc-eyebrow text-sb-ink">Who’s coming</span>
      <ul className="flex flex-wrap gap-2">{names.map((n, i) => <li key={`${n}-${i}`} className="twc-chip twc-chip--ring">{n}</li>)}</ul>
    </div>
  );
}

export function ShareButton({ title, path }: { title: string; path: string }) {
  const { toast, toastNode } = useToast();
  const share = async () => {
    const url = new URL(path, window.location.origin).href;
    try {
      if (typeof navigator.share === "function") return await navigator.share({ title, url });
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast("Couldn’t copy the link. You can copy it from the address bar.");
    }
    return undefined;
  };
  return (
    <>
      <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={() => void share()}>Share</button>
      {toastNode}
    </>
  );
}
