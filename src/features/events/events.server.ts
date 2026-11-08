// Server-only: gatherings, RSVPs and the headshot booking. Approval required (0001): pending members get nothing.
import type { Ctx } from "@/server/context.server";
import { requireMember } from "@/server/guard";
import { bad, isObject, str } from "@/server/validate";

export type EventRow = { id: string; title: string; description: string; location: string; neighborhood: string; starts_at: string; kind: string };
export type BookingStatus = "requested" | "confirmed" | "declined";
export type Booking = {
  id: string; user_id: string; preferred_date: string; preferred_time: string; notes: string; status: BookingStatus; created_at: string;
};
export type HeadshotRequest = { preferred_date: string; preferred_time: string; notes: string };

/** Events starting at or after `from` (ISO; all when omitted), soonest first. Members and admins only. */
export function listEvents({ db, actor }: Ctx, from?: string): EventRow[] {
  requireMember(db, actor);
  return db.prepare("select * from events where starts_at >= ? order by starts_at").all(from ?? "") as EventRow[];
}

/** Event ids she has an RSVP for. */
export function rsvps({ db, actor }: Ctx): string[] {
  const me = requireMember(db, actor);
  return (db.prepare("select event_id from event_rsvps where user_id = ?").all(me.id) as { event_id: string }[]).map((r) => r.event_id);
}

export function setRsvp({ db, actor }: Ctx, input: unknown): void {
  const me = requireMember(db, actor);
  if (!isObject(input) || typeof input.going !== "boolean") throw bad("RSVP");
  const eventId = str(input.eventId, "event", 64);
  if (input.going) db.prepare("insert into event_rsvps (user_id, event_id) values (?, ?) on conflict do nothing").run(me.id, eventId);
  else db.prepare("delete from event_rsvps where user_id = ? and event_id = ?").run(me.id, eventId);
}

/** Her single booking, or null. */
export function booking({ db, actor }: Ctx): Booking | null {
  const me = requireMember(db, actor);
  return (db.prepare("select * from headshot_bookings where user_id = ?").get(me.id) as Booking | undefined) ?? null;
}

/** Creates or changes her booking. A member can't confirm her own session: every write goes back to "requested". */
export function bookHeadshot({ db, actor }: Ctx, input: unknown): Booking {
  const me = requireMember(db, actor);
  if (!isObject(input)) throw bad("booking");
  const date = str(input.preferred_date, "date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad("date");
  const time = str(input.preferred_time, "time", 40);
  const notes = str(input.notes ?? "", "notes").slice(0, 300);
  db.prepare(
    `insert into headshot_bookings (user_id, preferred_date, preferred_time, notes, status) values (?, ?, ?, ?, 'requested')
     on conflict (user_id) do update set preferred_date = excluded.preferred_date, preferred_time = excluded.preferred_time,
       notes = excluded.notes, status = 'requested'`,
  ).run(me.id, date, time, notes);
  return db.prepare("select * from headshot_bookings where user_id = ?").get(me.id) as Booking;
}
