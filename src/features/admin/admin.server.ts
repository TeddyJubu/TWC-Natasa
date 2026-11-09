// Server-only: /admin. Every function starts with requireAdmin (the old is_admin() policies).
import type { Ctx } from "@/server/context.server";
import { tx } from "@/server/db";
import { requireAdmin } from "@/server/guard";
import { checkImage, removeMedia, writeMedia } from "@/server/media";
import { bad, isObject, oneOf, str, type Json } from "@/server/validate";
import { checkSize, fileBytes, readForm, respond } from "@/server/request";
import { toProfile, type MembershipStatus, type Profile } from "@/features/members/members.server";
import type { Booking, EventRow } from "@/features/events/events.server";
import { EVENT_KINDS } from "@/features/events/format";
import { neighborhoodRows, type NeighborhoodRow } from "@/features/neighborhoods/neighborhoods.server";
import { mediaUrl } from "@/server/media";
import { attachEmails, sortApplications, validateNeighborhood } from "./format";
import { sendApprovalEmail, type ApprovalEmailResult } from "./approval-email.server";


export type AdminApplication = {
  id: string; user_id: string | null; email: string; full_name: string; neighborhood: string; answers: { [key: string]: Json };
  status: MembershipStatus; created_at: string; reviewed_at: string | null; reviewed_by: string | null;
};
export type AdminMember = Profile & { email: string | null };
export type AdminNeighborhood = NeighborhoodRow & { logoUrl: string | null };
export type AdminBooking = Booking;
/** Someone who saved a seat: admin-only (the email especially). */
export type AdminGuest = {
  user_id: string; full_name: string; catalogue_number: number | null; neighborhood: string | null; email: string; saved_at: string;
};
export type AdminEvent = EventRow & { guests: AdminGuest[] };
const STATUSES = ["pending", "approved", "declined"] as const;

export function adminApplications({ db, actor }: Ctx): AdminApplication[] {
  requireAdmin(db, actor);
  const rows = db.prepare("select * from applications").all() as (Omit<AdminApplication, "answers"> & { answers: string })[];
  return sortApplications(rows.map((row) => ({ ...row, answers: JSON.parse(row.answers) as { [key: string]: Json } })));
}

/** Every profile, with the email from her linked application when there is one. Sorted by name. */
export function adminMembers({ db, actor }: Ctx): AdminMember[] {
  requireAdmin(db, actor);
  const profiles = (db.prepare("select * from profiles").all() as Parameters<typeof toProfile>[0][]).map(toProfile);
  const emails = db.prepare("select user_id, email from applications order by created_at desc").all() as { user_id: string | null; email: string }[];
  return attachEmails(profiles, emails).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** All neighborhoods, inactive ones included. A per-fetch ?v= stops the browser reusing a replaced logo. */
export function adminNeighborhoods(c: Ctx): AdminNeighborhood[] {
  requireAdmin(c.db, c.actor);
  const version = Date.now();
  return neighborhoodRows(c).map((row) => ({ ...row, logoUrl: row.logo_path ? `${mediaUrl("neighborhood-logos", row.logo_path)}?v=${version}` : null }));
}

export function adminBookings({ db, actor }: Ctx): AdminBooking[] {
  requireAdmin(db, actor);
  return db.prepare("select * from headshot_bookings order by preferred_date").all() as AdminBooking[];
}

/**
 * Reviews an application. The applications_review trigger timestamps it and gives a linked profile the same status;
 * reviewed_by records this admin, and only a real status change writes it.
 */
export function reviewApplication({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("review");
  const id = str(input.id, "application", 64);
  const status = oneOf(input.status, STATUSES, "status");
  db.prepare("update applications set status = ?, reviewed_by = ? where id = ? and status is not ?").run(status, me.id, id, status);
}

/**
 * Sets a profile's status directly. Approving or declining also gives her newest application the same decision
 * (0004), recorded as this admin; putting a profile back to pending isn't a review and leaves the application.
 * Returns that newest application's id (null when she has none), for the welcome email.
 */
export function setMemberStatus({ db, actor }: Ctx, input: unknown): string | null {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("review");
  const id = str(input.id, "member", 64);
  const status = oneOf(input.status, STATUSES, "status");
  return tx(db, () => {
    const changed = db.prepare("update profiles set status = ? where id = ? and status is not ?").run(status, id, status).changes > 0;
    const app = db.prepare("select id from applications where user_id = ? order by created_at desc, id desc limit 1").get(id) as { id: string } | undefined;
    if (changed && status !== "pending" && app) {
      db.prepare("update applications set status = ?, reviewed_by = ? where id = ? and status is not ?").run(status, me.id, app.id, status);
    }
    return app?.id ?? null;
  });
}

/** The welcome email for an approved application (after reviewApplication or setMemberStatus). */
export function approvalEmail({ db, actor }: Ctx, applicationId: string): Promise<ApprovalEmailResult> {
  requireAdmin(db, actor);
  return sendApprovalEmail(db, applicationId);
}

export function setBookingStatus({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("booking");
  const status = oneOf(input.status, ["requested", "confirmed", "declined"] as const, "status");
  db.prepare("update headshot_bookings set status = ? where id = ?").run(status, str(input.id, "booking", 64));
}

function neighborhoodFields(input: unknown, withSlug: boolean) {
  if (!isObject(input)) throw bad("neighborhood");
  const fields = {
    name: str(input.name, "name", 200).trim(),
    color: str(input.color, "color", 7),
    slug: withSlug ? str(input.slug, "slug", 100) : undefined,
    sort_order: Number.isInteger(input.sort_order) ? (input.sort_order as number) : 0,
    active: input.active === undefined ? true : input.active === true,
  };
  const problem = validateNeighborhood(fields);
  if (problem) throw bad(`neighborhood: ${problem}`);
  return fields;
}

export function createNeighborhood({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  const n = neighborhoodFields(input, true);
  db.prepare("insert into neighborhoods (slug, name, color, sort_order) values (?, ?, ?, ?)").run(n.slug!, n.name, n.color, n.sort_order);
}

/** Never the slug (it's the key). A rename cascades to profiles and events through the foreign keys. */
export function updateNeighborhood({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  const n = neighborhoodFields(input, false);
  const slug = str((input as Record<string, unknown>).slug, "slug", 100);
  db.prepare("update neighborhoods set name = ?, color = ?, sort_order = ?, active = ? where slug = ?").run(n.name, n.color, n.sort_order, n.active ? 1 : 0, slug);
}

/**
 * Stores `<slug>.<ext>` (replacing a same-name logo), points the row at it and removes an old logo saved under
 * another extension. Called once the row itself is saved, so a failure here never loses it.
 */
export function saveNeighborhoodLogo({ db, actor }: Ctx, slug: string, bytes: Uint8Array): string {
  requireAdmin(db, actor);
  const row = db.prepare("select logo_path from neighborhoods where slug = ?").get(slug) as { logo_path: string | null } | undefined;
  if (!row) throw bad("neighborhood");
  const name = `${slug}.${checkImage(bytes)}`;
  writeMedia("neighborhood-logos", name, bytes);
  db.prepare("update neighborhoods set logo_path = ? where slug = ?").run(name, slug);
  if (row.logo_path && row.logo_path !== name) removeMedia("neighborhood-logos", row.logo_path);
  return name;
}

/** POST /api/neighborhood-logos (FormData `slug`, `file`): size and admin are checked before the body is read. */
export function neighborhoodLogoRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, 6 * 1024 * 1024);
    requireAdmin(c.db, c.actor);
    const form = await readForm(request);
    return saveNeighborhoodLogo(c, str(form.get("slug"), "neighborhood", 100), await fileBytes(form));
  });
}

// ---------- Gatherings ----------

/** Every gathering, past ones included, soonest first, each with its guest list (oldest RSVP first). */
export function adminEvents({ db, actor }: Ctx): AdminEvent[] {
  requireAdmin(db, actor);
  const byEvent = new Map<string, AdminGuest[]>();
  // ponytail: every guest list in one read; page per event if lists grow past a few hundred seats.
  const guests = db.prepare(
    `select r.event_id, r.user_id, r.created_at as saved_at, coalesce(p.full_name, '') as full_name, p.catalogue_number, p.neighborhood, u.email
     from event_rsvps r join "user" u on u.id = r.user_id left join profiles p on p.id = r.user_id order by r.created_at`,
  ).all() as (AdminGuest & { event_id: string })[];
  for (const { event_id, ...guest } of guests) byEvent.set(event_id, [...(byEvent.get(event_id) ?? []), guest]);
  const events = db.prepare("select * from events order by starts_at").all() as EventRow[];
  return events.map((e) => ({ ...e, guests: byEvent.get(e.id) ?? [] }));
}

/** Today's events columns, checked: required text trimmed, a known neighborhood, an ISO start, a known kind. */
function eventFields(db: Ctx["db"], input: unknown) {
  if (!isObject(input)) throw bad("gathering");
  const title = str(input.title, "title", 200).trim();
  const location = str(input.location, "location", 200).trim();
  const description = str(input.description ?? "", "description", 600).trim();
  const neighborhood = str(input.neighborhood, "neighborhood", 200);
  const startsAt = str(input.starts_at, "start time", 40);
  if (!title) throw bad("title");
  if (!location) throw bad("location");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(startsAt) || Number.isNaN(Date.parse(startsAt))) throw bad("start time");
  if (!db.prepare("select 1 from neighborhoods where name = ?").get(neighborhood)) throw bad("neighborhood");
  return { title, description, location, neighborhood, starts_at: new Date(startsAt).toISOString(), kind: oneOf(input.kind, EVENT_KINDS, "kind") };
}

/** Returns the new gathering's id. */
export function createEvent({ db, actor }: Ctx, input: unknown): string {
  requireAdmin(db, actor);
  const e = eventFields(db, input);
  return (db.prepare("insert into events (title, description, location, neighborhood, starts_at, kind) values (?, ?, ?, ?, ?, ?) returning id")
    .get(e.title, e.description, e.location, e.neighborhood, e.starts_at, e.kind) as { id: string }).id;
}

export function updateEvent({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  const e = eventFields(db, input);
  const id = str((input as Record<string, unknown>).id, "gathering", 64);
  const changed = db.prepare("update events set title = ?, description = ?, location = ?, neighborhood = ?, starts_at = ?, kind = ? where id = ?")
    .run(e.title, e.description, e.location, e.neighborhood, e.starts_at, e.kind, id).changes;
  if (!changed) throw bad("gathering");
}

/** Its RSVPs go with it (on delete cascade); the UI confirms with the seat count first. */
export function deleteEvent({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("gathering");
  db.prepare("delete from events where id = ?").run(str(input.id, "gathering", 64));
}

// ---------- Inbox (migration 0002): /contact messages and /partnerships inquiries ----------

export type InboxMessage = {
  id: string; kind: "contact" | "partnership"; name: string; email: string; topic: string | null; business: string | null;
  collaboration_type: string | null; message: string; status: "new" | "archived"; created_at: string;
};

/** Messages still waiting (status new), newest first. Archived ones stay in the table, out of the list. */
export function adminInbox({ db, actor }: Ctx): InboxMessage[] {
  requireAdmin(db, actor);
  return db.prepare("select * from inbox_messages where status = 'new' order by created_at desc, rowid desc").all() as InboxMessage[];
}

// ponytail: archive only; add an "Archived" view + restore when admins ask for one.
export function archiveMessage({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("message");
  db.prepare("update inbox_messages set status = 'archived' where id = ?").run(str(input.id, "message", 64));
}
