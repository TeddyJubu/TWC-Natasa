import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { eventsQuery, rsvpsQuery } from "@/features/events/queries";
import { useToggleRsvp } from "@/features/events/mutations";
import { eventWhen } from "@/features/events/format";
import { errorMessage, hoodStyle, primaryButton, secondaryButton } from "./helpers";
import { Card, InlineError, Locked } from "./shared";

/** Upcoming gatherings with her RSVPs; applicants see what unlocks. */
export function GatheringsList({ userId, approved, hoodList }: { userId: string; approved: boolean; hoodList: Neighborhood[] }) {
  return (
    <Card id="gatherings" title="Gatherings" subtitle="Save your seat at what’s coming up">
      {approved ? <Events userId={userId} hoodList={hoodList} /> : <Locked />}
    </Card>
  );
}

function Events({ userId, hoodList }: { userId: string; hoodList: Neighborhood[] }) {
  const eventsState = useQuery(eventsQuery);
  const rsvpsState = useQuery(rsvpsQuery(userId));
  const toggle = useToggleRsvp(userId);
  const events = eventsState.data ?? [];
  const rsvps = new Set(rsvpsState.data ?? []);

  return (
    <>
      {(eventsState.isError || rsvpsState.isError) && (
        <InlineError
          message="We couldn’t load upcoming gatherings."
          onRetry={() => { if (eventsState.isError) void eventsState.refetch(); if (rsvpsState.isError) void rsvpsState.refetch(); }}
        />
      )}
      {toggle.isError && <p role="alert" className="px-5.5 py-3 text-sm text-danger">{errorMessage(toggle.error)}</p>}
      {eventsState.isSuccess && events.length === 0 && (
        <p className="px-5.5 py-4 text-[15px] text-app-muted">No gatherings on the calendar yet. We’ll post the next one here.</p>
      )}
      {events.length > 0 && (
        <ol className="divide-y divide-app-rule">
          {events.map((ev) => {
            const when = eventWhen(ev.starts_at);
            const going = rsvps.has(ev.id);
            const eventColor = toneFor(ev.neighborhood, hoodList)?.color;
            return (
              <li key={ev.id} className="grid grid-cols-[3.5rem_1fr] gap-4 px-5.5 py-4 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center">
                <div className="text-center">
                  <p className="flex items-center justify-center gap-1.5 text-xs uppercase text-app-muted">
                    <span aria-hidden className={cn("size-1.5 rounded-full", eventColor ? "bg-(--hood)" : "bg-app-line")} style={hoodStyle(eventColor)} />
                    {when.month}
                  </p>
                  <p className="font-display text-3xl leading-none text-ink">{when.day}</p>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-medium text-ink">{ev.title}</h3>
                  <p className="mt-0.5 text-[13.5px]/5 text-app-muted">{ev.location} · {ev.neighborhood} · {when.time}</p>
                  {ev.description && <p className="mt-1 text-[13.5px]/5 text-app-muted">{ev.description}</p>}
                </div>
                <button
                  type="button" aria-pressed={going} disabled={toggle.isPending || !rsvpsState.isSuccess}
                  onClick={() => toggle.mutate({ eventId: ev.id, going: !going })}
                  className={cn(going ? primaryButton : secondaryButton, "col-start-2 justify-self-start sm:col-start-3")}
                >
                  {going ? "✓ You’re going" : "Save my seat"}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
