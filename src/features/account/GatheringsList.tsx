import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { eventsQuery, rsvpsQuery } from "@/features/events/queries";
import { useToggleRsvp } from "@/features/events/mutations";
import { eventWhen } from "@/features/events/format";
import { ring, secondaryButton } from "@/app/layout/app-classes";
import { InlineError } from "@/app/layout/app-ui";
import { Icon } from "@/app/layout/icons";
import { errorMessage, hoodStyle } from "./helpers";
import { EmptySlot, Letter, TicketDate } from "@/app/layout/app-ui";
import { Locked } from "./shared";

/** Upcoming gatherings with her RSVPs; applicants see what unlocks. */
export function GatheringsList({ userId, approved, applied, hoodList }: { userId: string; approved: boolean; applied: boolean; hoodList: Neighborhood[] }) {
  return (
    <Letter id="gatherings" no={7} title="Gatherings" subtitle="Save your seat at what’s coming up">
      {approved ? <Events userId={userId} hoodList={hoodList} /> : <Locked applied={applied} />}
    </Letter>
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
      {toggle.isError && <p role="alert" className="pb-3 text-sm text-danger">{errorMessage(toggle.error)}</p>}
      {eventsState.isSuccess && events.length === 0 && (
        <EmptySlot icon="calendar-days"><p>No gatherings on the calendar yet. We’ll post the next one here.</p></EmptySlot>
      )}
      {events.length > 0 && (
        <ol className="air-tickets lg:grid-cols-2">
          {events.map((ev) => {
            const when = eventWhen(ev.starts_at);
            const going = rsvps.has(ev.id);
            const color = toneFor(ev.neighborhood, hoodList)?.color;
            return (
              <li key={ev.id} className="air-ticket">
                <TicketDate when={when} />
                <div className="air-t-body">
                  <h3>{ev.title}</h3>
                  <p className="air-meta">
                    <Icon name="map-pin" />
                    <span><span className="sr-only">{when.weekday}, {when.month} {when.day} · </span>{ev.location} · <span className="inline-flex items-center gap-1.5">{color && <span aria-hidden className="size-2 rounded-full bg-(--hood)" style={hoodStyle(color)} />}{ev.neighborhood}</span> · {when.time}</span>
                  </p>
                  <div className="air-t-row">
                    {ev.description && <p>{ev.description}</p>}
                    {/* Going is a state with a quiet way out; the invitation is the only filled button. */}
                    {going ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="air-btn air-btn--navy air-btn--sm cursor-default"><Icon name="check" />You’re going</span>
                        <button
                          type="button" disabled={toggle.isPending} onClick={() => toggle.mutate({ eventId: ev.id, going: false })}
                          className={cn("air-link", ring)}
                        >
                          Can’t make it<span className="sr-only"> to {ev.title}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button" disabled={toggle.isPending || !rsvpsState.isSuccess}
                        onClick={() => toggle.mutate({ eventId: ev.id, going: true })}
                        className={cn(secondaryButton, "shrink-0")}
                      >
                        Save my seat<span className="sr-only"> at {ev.title}</span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
