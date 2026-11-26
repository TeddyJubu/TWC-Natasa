// The public events pages' pieces, on the canvas kit (twc-sections.css, twc-public.css). Everything here renders the allowlisted `CalEvent`.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { Icon } from "@/app/layout/twc";
import { isEnded, isFull, kindClass, type GatheringsView } from "./event-state";
import type { CalEvent } from "./types";
import { CancelledBadge, CategoryChip, DateTimeText, EndedBadge, StatusBadge, useToast } from "./ui";

export function EventStatus({ event }: { event: CalEvent }) {
  if (event.status === "CANCELLED") return <CancelledBadge />;
  if (isEnded(event)) return <EndedBadge />;
  if (isFull(event)) return <StatusBadge kind="full" />;
  return null;
}

/** The categories on screen, each once, with the field it wears, for the calendar's legend. */
export function KindLegend({ events }: { events: Pick<CalEvent, "category">[] }) {
  const categories = [...new Set(events.map((e) => e.category).filter((c): c is string => !!c))].sort();
  if (!categories.length) return null;
  return (
    <ul aria-label="Categories" className="twc-legend">
      {categories.map((c) => <li key={c}><span aria-hidden className={cn("twc-e", kindClass(c))} />{c}</li>)}
    </ul>
  );
}

const pressable = "twc-choice twc-choice--filter";

export function EventsTabs({ tab, onChange }: { tab: "upcoming" | "past"; onChange: (tab: "upcoming" | "past") => void }) {
  return (
    <div role="group" aria-label="Which events" className="twc-filters mb-0">
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
    <div role="group" aria-label="View as" className="twc-filters mb-0">
      {(["grid", "calendar"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v || (v === "grid" && view === "list")} className={pressable} onClick={() => onChange(v)}>
          {v === "grid" ? "Program" : "Calendar"}
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
      <div role="group" aria-labelledby={id} className="twc-filters mb-0">
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

/**
 * The cover from our own origin (`coverSrc`). One that failed shows `fallback`, including a failure before hydration,
 * when React wasn't there yet to hear the error event.
 */
export function CoverImage({ event, className, fallback = null }: { event: Pick<CalEvent, "coverSrc">; className?: string; fallback?: React.ReactNode }) {
  const src = event.coverSrc;
  const [failed, setFailed] = React.useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    <img
      src={src} alt="" loading="lazy" className={cn("object-cover", className)} onError={() => setFailed(src)}
      ref={(img) => { if (img?.complete && !img.naturalWidth) setFailed(src); }}
    />
  );
}

const eventLink = (event: CalEvent, business?: string) => ({
  to: "/events/$slug" as const, params: { slug: event.slug }, ...(business ? { search: { business } } : {}),
});

/** The canvas programme: one lifted, gently tilted colour strip per event, its field from its category. */
export function EventList({ events, business }: { events: CalEvent[]; business?: string }) {
  return (
    <ol className="twc-evs twc-evs--list twc-bleed">
      {events.map((e) => (
        <li key={e.uid} className={cn("twc-ev", kindClass(e.category))}>
          <div className="min-w-0">
            <h3>
              <Link {...eventLink(e, business)} className="no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sb-ink">
                {e.title}
              </Link>
            </h3>
            {(e.category || e.status === "CANCELLED" || isEnded(e) || isFull(e)) && (
              <div className="twc-ev__tags">
                {e.category && <CategoryChip category={e.category} />}
                <EventStatus event={e} />
              </div>
            )}
          </div>
          <p className="twc-meta"><EventDateTime event={e} /></p>
          <p className="twc-meta">{e.location && <EventLocation location={e.location} />}</p>
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 border-t border-sb-ink bg-sb-cream px-6 py-8">
      <p className="font-display text-[32px] font-extrabold leading-none [font-stretch:75%]">{title}</p>
      {children && <div className="text-sb-ink">{children}</div>}
    </div>
  );
}

export function EventsSkeleton() {
  return (
    <div role="status" aria-label="Loading events" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-(--twc-radius-card) bg-sb-cream motion-safe:animate-pulse" />)}
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

/** The next few gatherings, for /embed/events. Links open the site in a new tab, out of the frame. */
export function EventsWidget({ events }: { events: CalEvent[] }) {
  if (!events.length) return <p className="text-sb-muted">No events on the calendar yet.</p>;
  return (
    <ul className="flex flex-col">
      {events.map((e) => (
        <li key={e.uid} className="flex flex-col gap-1.5 border-t border-sb-ink py-3">
          <a href={`/events/${encodeURIComponent(e.slug)}`} target="_blank" rel="noopener" className="twc-link font-display text-2xl font-extrabold leading-none [font-stretch:75%]">
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
    <header>
      <div className="px-(--twc-gut) py-5">
        <Link to="/events" className="twc-link inline-flex w-fit items-center gap-1.5 font-plex text-xs uppercase tracking-[0.08em]">
          <Icon name="arrowLeft" className="size-3.5" /> All events
        </Link>
      </div>
      <div className={cn("twc-phd", kindClass(event.category))}>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {event.category && <CategoryChip category={event.category} />}
            <EventStatus event={event} />
          </div>
          <h1 className="twc-display break-words">{event.title}</h1>
        </div>
      </div>
      <CoverImage event={event} className="block max-h-[480px] w-full border-t border-sb-ink" />
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
  return <p className="twc-measure text-[17px]/[1.6] break-words whitespace-pre-line">{text}</p>;
}

export function HostCard({ host }: { host: CalEvent["host"] }) {
  if (!host.name) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-sb-ink pt-3">
      <span className="twc-eyebrow text-sb-ink">Hosted by</span>
      <span className="font-display text-[26px] font-extrabold leading-none [font-stretch:75%]">{host.name}</span>
    </div>
  );
}

export function CapacityBar({ event }: { event: Pick<CalEvent, "capacity" | "spotsLeft"> }) {
  if (event.capacity === null) return null;
  const left = Math.max(event.spotsLeft ?? 0, 0);
  const taken = Math.min(event.capacity - left, event.capacity);
  return (
    <div className="flex flex-col gap-1.5">
      <progress className="h-2.5 w-full appearance-none overflow-hidden rounded-full border border-sb-ink bg-sb-paper [&::-moz-progress-bar]:bg-sb-ink [&::-webkit-progress-bar]:bg-sb-paper [&::-webkit-progress-value]:bg-sb-ink" max={event.capacity} value={taken} aria-label="Spots taken">{taken} of {event.capacity}</progress>
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
    <div className="flex flex-col gap-2 border-t border-sb-ink pt-3">
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
