// Server-only: the headshot booking. Gatherings and their RSVPs live in Cal (src/features/cal/cal.server.ts); the old
// `events` and `event_rsvps` rows stay in the database, unread. Approval required (0001): pending members get nothing.
import type { Ctx } from "@/server/context.server";
import type { GatheringRow } from "@/features/cal/cal.server";
import { requireMember } from "@/server/guard";
import { bad, isObject, str } from "@/server/validate";

export type { MemberPlan } from "@/features/cal/cal.server";
export type EventRow = GatheringRow;
/** What anyone may see of a gathering: no RSVPs, no member data. */
export type PublicEvent = GatheringRow;
export type BookingStatus = "requested" | "confirmed" | "declined";
export type Booking = {
  id: string; user_id: string; preferred_date: string; preferred_time: string; notes: string; status: BookingStatus; created_at: string;
};
export type HeadshotRequest = { preferred_date: string; preferred_time: string; notes: string };

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
