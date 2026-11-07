import { useQuery } from "@tanstack/react-query";
import { Button, cn } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { eventsQuery, rsvpsQuery } from "@/features/events/queries";
import { useToggleRsvp } from "@/features/events/mutations";
import { eventWhen } from "@/features/events/format";
import { errorMessage, hoodStyle } from "./helpers";
import { InlineError } from "./shared";

/** 02 — upcoming gatherings with her RSVPs. Approved members only (the route shows Locked otherwise). */
export function GatheringsList({ userId, hoodList }: { userId: string; hoodList: Neighborhood[] }) {
  const eventsState = useQuery(eventsQuery);
  const rsvpsState = useQuery(rsvpsQuery(userId));
  const toggle = useToggleRsvp(userId);
  const events = eventsState.data ?? [];
  const rsvps = new Set(rsvpsState.data ?? []);

  return (
    <div className="flex flex-col gap-6">
    {(eventsState.isError || rsvpsState.isError) && (
      <InlineError
        message="We couldn’t load upcoming gatherings."
        onRetry={() => { if (eventsState.isError) void eventsState.refetch(); if (rsvpsState.isError) void rsvpsState.refetch(); }}
      />
    )}
    {toggle.isError && <p role="alert" className="text-sm text-danger">{errorMessage(toggle.error)}</p>}
    {eventsState.isSuccess && events.length === 0 && (
      <p className="border-t border-line pt-7 text-sm text-ink-muted">No gatherings on the calendar yet. We’ll post the next one here.</p>
    )}
    <ol className="flex flex-col border-t border-line empty:hidden">
      {events.map((ev) => {
        const when = eventWhen(ev.starts_at);
        const going = rsvps.has(ev.id);
        const eventColor = toneFor(ev.neighborhood, hoodList)?.color;
        return (
          <li key={ev.id} className="motion-scroll-reveal grid grid-cols-[4.5rem_1fr] gap-6 border-b border-line py-7 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center">
            <div className="text-center"><p className={cn("text-xs uppercase", eventColor && "text-(--hood)")} style={hoodStyle(eventColor)}>{when.month}</p><p className="font-display text-5xl leading-none">{when.day}</p></div>
            <div className="min-w-0">
              <h3 className="font-display text-2xl">{ev.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{ev.location} · {ev.neighborhood} · {when.time}</p>
              <p className="mt-2 text-sm text-ink-muted">{ev.description}</p>
            </div>
            <Button size="sm" variant={going ? "white" : "outline"} aria-pressed={going} disabled={toggle.isPending || !rsvpsState.isSuccess} onClick={() => toggle.mutate({ eventId: ev.id, going: !going })} className="col-start-2 justify-self-start sm:col-start-3">{going ? "✓ You’re going" : "Save my seat"}</Button>
          </li>
        );
      })}
    </ol>
    </div>
  );
}
