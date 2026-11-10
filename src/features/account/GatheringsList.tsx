import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { eventsQuery, rsvpsQuery } from "@/features/events/queries";
import { useToggleRsvp } from "@/features/events/mutations";
import { eventWhen } from "@/features/events/format";
import { primaryButton, secondaryButton } from "@/app/layout/app-classes";
import { Card, InlineError } from "@/app/layout/app-ui";
import { Icon } from "@/app/layout/icons";
import { errorMessage, hoodStyle } from "./helpers";
import { Locked } from "./shared";

/** Upcoming gatherings with her RSVPs; applicants see what unlocks. */
export function GatheringsList({ userId, approved, applied, hoodList }: { userId: string; approved: boolean; applied: boolean; hoodList: Neighborhood[] }) {
  return (
    <Card id="gatherings" title="Gatherings" subtitle="Save your seat at what’s coming up">
      {approved ? <Events userId={userId} hoodList={hoodList} /> : <Locked applied={applied} />}
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
      {toggle.isError && <p role="alert" className="px-4 py-3 text-sm text-danger sm:px-5.5">{errorMessage(toggle.error)}</p>}
      {eventsState.isSuccess && events.length === 0 && (
        <p className="px-4 py-4 text-[15px] text-app-muted sm:px-5.5">No gatherings on the calendar yet. We’ll post the next one here.</p>
      )}
      {events.length > 0 && (
        <ol>
          {events.map((ev) => {
            const when = eventWhen(ev.starts_at);
            const going = rsvps.has(ev.id);
            const eventColor = toneFor(ev.neighborhood, hoodList)?.color;
            return (
              <li key={ev.id} className="grid grid-cols-[3.5rem_1fr] gap-4 px-4 py-4 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center sm:px-5.5">
                <DateTile month={when.month} day={when.day} color={eventColor} />
                <div className="min-w-0">
                  <h3 className="font-geist text-[17px]/[1.35] font-medium text-ink">{ev.title}</h3>
                  <p className="mt-0.5 text-[13px]/[1.5] text-app-muted">{ev.location} · {ev.neighborhood} · {when.time}</p>
                  {ev.description && <p className="mt-1 text-[13px]/[1.5] text-app-muted">{ev.description}</p>}
                </div>
                <button
                  type="button" aria-pressed={going} disabled={toggle.isPending || !rsvpsState.isSuccess}
                  onClick={() => toggle.mutate({ eventId: ev.id, going: !going })}
                  className={cn(going ? primaryButton : secondaryButton, "col-start-2 justify-self-start sm:col-start-3")}
                >
                  {going ? <><Icon name="check" className="size-3.5" />You’re going</> : "Save my seat"}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

/** The pale-sage month/day tile; the dot is the gathering's neighborhood color. */
export function DateTile({ month, day, color }: { month: string; day: string | number; color?: string }) {
  return (
    <div className="flex w-14 shrink-0 flex-col gap-0.5 rounded-xl bg-app-sunken pt-1.5 pb-2 text-center">
      <p className="flex items-center justify-center gap-1 font-fragment text-[11px]/[14px] tracking-[1px] uppercase text-app-muted">
        <span aria-hidden className={cn("size-1.5 rounded-full", color ? "bg-(--hood)" : "bg-app-line")} style={hoodStyle(color)} />
        {month}
      </p>
      <p className="font-geist text-[26px]/none text-ink">{day}</p>
    </div>
  );
}
