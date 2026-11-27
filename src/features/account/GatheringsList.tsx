import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import type { Neighborhood } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { eventsQuery, plansQuery, type EventRow, type MemberPlan } from "@/features/events/queries";
import { usePlanChange, type PlanChange } from "@/features/events/mutations";
import { eventWhen } from "@/features/events/format";
import { ring, secondaryButton } from "@/app/layout/app-classes";
import { Chip, EmptySlot, InlineError, Letter, TicketDate } from "@/app/layout/app-ui";
import { Icon } from "@/app/layout/icons";
import { errorMessage, hoodStyle } from "./helpers";
import { Locked } from "./shared";

/** Upcoming events with her answers; applicants see what unlocks. */
export function GatheringsList({ userId, approved, applied, declined, hoodList }: { userId: string; approved: boolean; applied: boolean; declined: boolean; hoodList: Neighborhood[] }) {
  return (
    <Letter id="events" no={7} title="Events" subtitle={declined ? "For members of the collective" : "Save your seat at what’s coming up"}>
      {approved ? <Events userId={userId} hoodList={hoodList} /> : <Locked applied={applied} declined={declined} />}
    </Letter>
  );
}

/**
 * Her real answer on each event, from one call (plansQuery): the events she has answered first, under "Your plans",
 * then the rest under "Coming up".
 */
function Events({ userId, hoodList }: { userId: string; hoodList: Neighborhood[] }) {
  const eventsState = useQuery(eventsQuery);
  const plansState = useQuery(plansQuery(userId));
  const change = usePlanChange(userId);
  const id = React.useId();
  const events = eventsState.data ?? [];
  const plans = new Map((plansState.data ?? []).map((p) => [p.eventId, p]));
  const mine = events.filter((ev) => plans.has(ev.id));
  const rest = events.filter((ev) => !plans.has(ev.id));
  const ticket = (ev: EventRow) => (
    <Ticket
      key={ev.id} ev={ev} plan={plans.get(ev.id)} color={toneFor(ev.neighborhood, hoodList)?.color}
      // Until her answers are in, nothing offers a seat she may already hold.
      ready={plansState.isSuccess} busy={change.isPending} onChange={(c) => change.mutate(c)}
    />
  );

  return (
    <>
      {(eventsState.isError || plansState.isError) && (
        <InlineError
          message="We couldn’t load upcoming events."
          onRetry={() => { if (eventsState.isError) void eventsState.refetch(); if (plansState.isError) void plansState.refetch(); }}
        />
      )}
      {change.isError && <p role="alert" className="pb-3 text-sm text-danger">{errorMessage(change.error)}</p>}
      {eventsState.isSuccess && events.length === 0 && (
        <EmptySlot icon="calendar-days"><p>No events on the calendar yet. We’ll post the next one here.</p></EmptySlot>
      )}
      {mine.length > 0 && (
        <>
          <h3 id={`${id}-plans`} className="air-lbl">Your plans</h3>
          <ol aria-labelledby={`${id}-plans`} className="air-tickets lg:grid-cols-2">{mine.map(ticket)}</ol>
        </>
      )}
      {rest.length > 0 && (
        <>
          {mine.length > 0 && <h3 id={`${id}-next`} className="air-lbl mt-8">Coming up</h3>}
          <ol aria-labelledby={mine.length > 0 ? `${id}-next` : undefined} className="air-tickets lg:grid-cols-2">{rest.map(ticket)}</ol>
        </>
      )}
    </>
  );
}

function Ticket({ ev, plan, color, ready, busy, onChange }: {
  ev: EventRow; plan?: MemberPlan; color?: string; ready: boolean; busy: boolean; onChange: (change: PlanChange) => void;
}) {
  const when = eventWhen(ev.starts_at);
  const quiet = cn("air-link", ring);
  const going = plan?.status === "GOING";
  const maybe = plan?.status === "MAYBE";
  const waiting = !!plan?.waitlisted && !going;
  const named = (verb: string, prep: string) => <>{verb}<span className="sr-only"> {prep} {ev.title}</span></>;
  const seat = (label: string) => (
    <button type="button" disabled={busy || !ready} onClick={() => onChange({ eventId: ev.id, going: true })} className={cn(secondaryButton, "shrink-0")}>
      {named(label, "at")}
    </button>
  );
  const joinWaitlist = (label: string) => (
    <button type="button" disabled={busy || !ready} onClick={() => onChange({ eventId: ev.id, waitlist: true })} className={cn(secondaryButton, "shrink-0")}>
      {named(label, "for")}
    </button>
  );
  const cantMake = (
    <button type="button" disabled={busy} onClick={() => onChange({ eventId: ev.id, going: false })} className={quiet}>
      {named("Can’t make it", "to")}
    </button>
  );

  return (
    <li className="air-ticket">
      <TicketDate when={when} />
      <div className="air-t-body">
        {/* The event page takes a slug or a uid, so a row without a slug still opens its page. */}
        <h4>
          <Link to="/events/$slug" params={{ slug: ev.slug || ev.id }} className={cn("no-underline hover:underline", ring)}>{ev.title}</Link>
        </h4>
        <p className="air-meta">
          <Icon name="map-pin" />
          <span><span className="sr-only">{when.weekday}, {when.month} {when.day} · </span>{ev.location} · <span className="inline-flex items-center gap-1.5">{color && <span aria-hidden className="size-2 rounded-full bg-(--hood)" style={hoodStyle(color)} />}{ev.neighborhood}</span> · {when.time}</span>
        </p>
        <div className="air-t-row">
          {ev.description && <p>{ev.description}</p>}
          {/* Her answer is a state with a quiet way out; an invitation is the only button with a border. */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            {going ? (
              <>
                <span className="air-btn air-btn--navy air-btn--sm cursor-default"><Icon name="check" />You’re going</span>
                {cantMake}
              </>
            ) : waiting ? (
              <>
                <Chip tone="pending">On the waitlist</Chip>
                <button type="button" disabled={busy} onClick={() => onChange({ eventId: ev.id, waitlist: false })} className={quiet}>
                  {named("Leave the waitlist", "for")}
                </button>
              </>
            ) : maybe ? (
              <>
                <Chip>Maybe</Chip>
                {ev.full ? joinWaitlist("Join the waitlist") : seat("I’m going")}
                {cantMake}
              </>
            ) : ev.full ? (
              joinWaitlist("Full · Join the waitlist")
            ) : (
              seat("Save my seat")
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
