// Server-only: /admin. Every function starts with requireAdmin (the old is_admin() policies).
import type { Ctx } from "@/server/context.server";
import { tx } from "@/server/db";
import { AccessError, requireAdmin } from "@/server/guard";
import { checkImage, removeMedia, writeMedia } from "@/server/media";
import { bad, isObject, oneOf, str, type Json } from "@/server/validate";
import { checkSize, fileBytes, readForm, respond } from "@/server/request";
import { toProfile, type MembershipStatus, type Profile } from "@/features/members/members.server";
import type { Booking, EventRow } from "@/features/events/events.server";
import { EVENT_KINDS } from "@/features/events/format";
import { neighborhoodRows, type NeighborhoodRow } from "@/features/neighborhoods/neighborhoods.server";
import { mediaUrl } from "@/server/media";
import {
  attachEmails, duplicatesOf, isCalendarDate, LOGGED_ACTION_KINDS, sortApplications, toCsv, validateNeighborhood,
  type ActionKind, type Duplicate, type LoggedActionKind,
} from "./format";
import { sendApprovalEmail, type ApprovalEmailResult } from "./approval-email.server";


export type AdminApplication = {
  id: string; user_id: string | null; email: string; full_name: string; neighborhood: string; answers: { [key: string]: Json };
  status: MembershipStatus; created_at: string; reviewed_at: string | null; reviewed_by: string | null;
  /** CRM-072/073: set on a pending application only (see duplicatesOf). */
  duplicate: Duplicate | null;
};
/**
 * `newsletter`: the `newsletter_subscribers` row for her account (else application) email, null when she isn't on it;
 * `applications`: how many applications are linked to her account or sent from her account email (CRM-038).
 */
export type AdminMember = Profile & { email: string | null; newsletter: { consent: 0 | 1 | null } | null; applications: number };
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
  const rows = db.prepare("select * from applications").all() as (Omit<AdminApplication, "answers" | "duplicate"> & { answers: string })[];
  // Approved members by account, plus imported members who haven't signed up yet (legacy_members, 0004).
  const memberEmails = new Set((db.prepare(
    `select lower(u.email) as email from profiles p join "user" u on u.id = p.id where p.status = 'approved'
     union select email from legacy_members where user_id is null`,
  ).all() as { email: string }[]).map((r) => r.email));
  const memberIds = new Set((db.prepare("select id from profiles where status = 'approved'").all() as { id: string }[]).map((r) => r.id));
  const duplicates = duplicatesOf(rows, memberEmails, memberIds);
  return sortApplications(rows.map((row) => ({
    ...row, answers: JSON.parse(row.answers) as { [key: string]: Json }, duplicate: duplicates.get(row.id) ?? null,
  })));
}

/** Every profile, with the email from her linked application when there is one, and her summary. Sorted by name. */
export function adminMembers({ db, actor }: Ctx): AdminMember[] {
  requireAdmin(db, actor);
  const profiles = (db.prepare("select * from profiles").all() as Parameters<typeof toProfile>[0][]).map(toProfile);
  const emails = db.prepare("select user_id, email from applications order by created_at desc").all() as { user_id: string | null; email: string }[];
  const accounts = new Map((db.prepare(`select id, lower(email) as email from "user"`).all() as { id: string; email: string }[]).map((u) => [u.id, u.email]));
  const newsletter = new Map((db.prepare("select email, consent from newsletter_subscribers").all() as { email: string; consent: 0 | 1 | null }[])
    .map((n) => [n.email, { consent: n.consent }]));
  return attachEmails(profiles, emails).map((m) => {
    const account = accounts.get(m.id);
    // ponytail: one pass over every application per member (~250 × ~130); index by email if the lists grow.
    const applications = emails.filter((a) => a.user_id === m.id || (account !== undefined && a.email.toLowerCase() === account)).length;
    return { ...m, newsletter: newsletter.get(account ?? "") ?? newsletter.get(m.email?.toLowerCase() ?? "") ?? null, applications };
  }).sort((a, b) => a.full_name.localeCompare(b.full_name));
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

/** Appends to admin_actions (0007) inside the caller's transaction, so a change and its record land together. */
function logAction(db: Ctx["db"], actorId: string, action: ActionKind, subject: { application_id: string } | { member_id: string }, detail = ""): void {
  db.prepare("insert into admin_actions (actor_id, action, application_id, member_id, detail) values (?, ?, ?, ?, ?)")
    .run(actorId, action, "application_id" in subject ? subject.application_id : null, "member_id" in subject ? subject.member_id : null, detail);
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
  tx(db, () => {
    const changed = db.prepare("update applications set status = ?, reviewed_by = ? where id = ? and status is not ?").run(status, me.id, id, status).changes > 0;
    if (changed) logAction(db, me.id, status, { application_id: id });
  });
}

/**
 * Sets a profile's status directly. Approve, decline and undo-decline (back to pending) also give her newest
 * application the same decision (0004 / CRM-069), recorded as this admin.
 * Returns that newest application's id (null when she has none), for the welcome email.
 */
export function setMemberStatus({ db, actor }: Ctx, input: unknown): string | null {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("review");
  const id = str(input.id, "member", 64);
  const status = oneOf(input.status, STATUSES, "status");
  return tx(db, () => {
    const changed = db.prepare("update profiles set status = ? where id = ? and status is not ?").run(status, id, status).changes > 0;
    if (changed) logAction(db, me.id, status, { member_id: id });
    const app = db.prepare("select id from applications where user_id = ? order by created_at desc, id desc limit 1").get(id) as { id: string } | undefined;
    if (changed && app) {
      db.prepare("update applications set status = ?, reviewed_by = ? where id = ? and status is not ?").run(status, me.id, app.id, status);
    }
    return app?.id ?? null;
  });
}

/**
 * CRM-059: an admin corrects a member's neighborhood — one on the list, or none (`null` / ""). Only the profile
 * changes; her application keeps the answer she gave.
 */
export function setMemberNeighborhood({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("member");
  const id = str(input.id, "member", 64);
  const name = input.neighborhood === null ? null : str(input.neighborhood, "neighborhood", 200) || null;
  if (name && !db.prepare("select 1 from neighborhoods where name = ?").get(name)) throw bad("neighborhood");
  tx(db, () => {
    const before = db.prepare("select neighborhood from profiles where id = ?").get(id) as { neighborhood: string | null } | undefined;
    if (!before) throw bad("member");
    if (before.neighborhood === name) return;
    db.prepare("update profiles set neighborhood = ? where id = ?").run(name, id);
    logAction(db, me.id, "neighborhood", { member_id: id }, name ?? "");
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

/** Every contact / partnership message (new and archived), newest first. The Inbox card filters to Needs attention or Archived. */
export function adminInbox({ db, actor }: Ctx): InboxMessage[] {
  requireAdmin(db, actor);
  return db.prepare("select * from inbox_messages order by created_at desc, rowid desc").all() as InboxMessage[];
}

/** Marks a message archived (CRM-091). No restore yet — the Archived filter is read-only. */
export function archiveMessage({ db, actor }: Ctx, input: unknown): void {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("message");
  db.prepare("update inbox_messages set status = 'archived' where id = ?").run(str(input.id, "message", 64));
}

// ---------- Notes (migration 0006, CRM-055) ----------

export type AdminNote = {
  id: string; application_id: string | null; member_id: string | null; author_name: string | null; body: string; created_at: string;
};

/** Every note, oldest first; the page groups them by application or member. */
export function adminNotes({ db, actor }: Ctx): AdminNote[] {
  requireAdmin(db, actor);
  return db.prepare(
    `select n.id, n.application_id, n.member_id, nullif(trim(coalesce(p.full_name, u.name, '')), '') as author_name, n.body, n.created_at
     from admin_notes n left join "user" u on u.id = n.author_id left join profiles p on p.id = n.author_id order by n.created_at, n.rowid`,
  ).all() as AdminNote[];
}

/** `{ applicationId | memberId, body }`: 1–5,000 characters after trimming, on a row that exists. Returns the new note's id. */
export function addNote({ db, actor }: Ctx, input: unknown): string {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("note");
  const body = str(input.body, "note", 5000).trim();
  if (!body) throw bad("note");
  const [column, table] = input.applicationId !== undefined ? ["application_id", "applications"] : ["member_id", "profiles"];
  const subject = str(input.applicationId ?? input.memberId, "note", 64);
  if (!db.prepare(`select 1 from ${table} where id = ?`).get(subject)) throw bad("note");
  return tx(db, () => {
    const id = (db.prepare(`insert into admin_notes (${column}, author_id, body) values (?, ?, ?) returning id`).get(subject, me.id, body) as { id: string }).id;
    logAction(db, me.id, "note_added", column === "application_id" ? { application_id: subject } : { member_id: subject });
    return id;
  });
}

export function deleteNote({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("note");
  const id = str(input.id, "note", 64);
  tx(db, () => {
    const note = db.prepare("delete from admin_notes where id = ? returning application_id, member_id").get(id) as { application_id: string | null; member_id: string | null } | undefined;
    if (note) logAction(db, me.id, "note_deleted", note.application_id ? { application_id: note.application_id } : { member_id: note.member_id! });
  });
}

// ---------- Admin activity (migration 0007): append-only, newest first ----------

export type AdminAction = {
  id: number; action: ActionKind; application_id: string | null; member_id: string | null; detail: string; created_at: string;
  actor_name: string | null; subject_name: string | null;
};

// ponytail: newest 100 only; add paging (or a date filter) when admins need older history on screen.
export function adminActions({ db, actor }: Ctx): AdminAction[] {
  requireAdmin(db, actor);
  return db.prepare(
    `select a.id, a.action, a.application_id, a.member_id, a.detail, a.created_at,
       coalesce(nullif(trim(ap.full_name), ''), nullif(trim(au.name), '')) as actor_name,
       case when a.application_id is not null then app.full_name
            when mu.id is not null then coalesce(nullif(trim(mp.full_name), ''), nullif(trim(mu.name), ''), 'Unnamed member') end as subject_name
     from admin_actions a
     left join "user" au on au.id = a.actor_id left join profiles ap on ap.id = a.actor_id
     left join applications app on app.id = a.application_id
     left join "user" mu on mu.id = a.member_id left join profiles mp on mp.id = a.member_id
     order by a.id desc limit 100`,
  ).all() as AdminAction[];
}

// ---------- CSV export (CRM-186): the columns /admin shows, plus every answer as JSON (OPS-037's payload_json) ----------

export type CsvExport = { filename: string; csv: string };
const yesNo = (b: boolean) => (b ? "Yes" : "No");

export function adminCsv(c: Ctx, input: unknown): CsvExport {
  const kind = oneOf(isObject(input) ? input.kind : undefined, ["applications", "members"] as const, "export");
  const filename = `twc-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  if (kind === "applications") {
    const rows = adminApplications(c).map((a) => [
      a.created_at, a.full_name, a.email, a.neighborhood, typeof a.answers.business === "string" ? a.answers.business : "",
      a.status, a.reviewed_at, yesNo(a.user_id !== null), JSON.stringify(a.answers),
    ]);
    return { filename, csv: toCsv(["Submitted (UTC)", "Name", "Email", "Neighborhood", "Business", "Status", "Reviewed (UTC)", "Account", "Answers (JSON)"], rows) };
  }
  const rows = adminMembers(c).map((m) => [
    m.full_name, m.status, yesNo(m.directory_visible), yesNo(m.public_profile), m.catalogue_number, m.email, m.business, m.neighborhood, m.member_since,
  ]);
  return { filename, csv: toCsv(["Name", "Status", "Listed", "Public", "Catalogue", "Email", "Business", "Neighborhood", "Member since"], rows) };
}

// ---------- Logged actions (migration 0009, CRM-057 / CRM-058): outside-the-app work, not admin_actions ----------

export type LoggedAction = {
  id: string; application_id: string | null; member_id: string | null; kind: LoggedActionKind; action_date: string;
  note: string; removed_at: string | null; author_name: string | null; created_at: string; updated_at: string;
};

type ActionFields = { kind: LoggedActionKind; action_date: string; note: string };

function parseLoggedFields(input: Record<string, unknown>): ActionFields {
  const kind = oneOf(input.kind, LOGGED_ACTION_KINDS, "action");
  const action_date = str(input.actionDate ?? input.action_date, "date", 10);
  if (!isCalendarDate(action_date)) throw bad("date");
  const note = str(input.note ?? "", "note", 1000).trim();
  if (kind === "other" && !note) throw bad("note");
  return { kind, action_date, note };
}

function appendLoggedEvent(db: Ctx["db"], actionId: string, actorId: string, event: "created" | "edited" | "removed" | "restored", fields: ActionFields): void {
  db.prepare("insert into logged_action_events (action_id, actor_id, event, kind, action_date, note) values (?, ?, ?, ?, ?, ?)")
    .run(actionId, actorId, event, fields.kind, fields.action_date, fields.note);
}

/** Every logged action (including soft-removed), newest action_date first; the page groups by subject. */
export function adminLoggedActions({ db, actor }: Ctx): LoggedAction[] {
  requireAdmin(db, actor);
  return db.prepare(
    `select a.id, a.application_id, a.member_id, a.kind, a.action_date, a.note, a.removed_at, a.created_at, a.updated_at,
       nullif(trim(coalesce(p.full_name, u.name, '')), '') as author_name
     from logged_actions a left join "user" u on u.id = a.author_id left join profiles p on p.id = a.author_id
     order by a.action_date desc, a.created_at desc, a.rowid desc`,
  ).all() as LoggedAction[];
}

/** `{ applicationId | memberId, kind, actionDate, note? }` on a row that exists. Returns the new id. */
export function addLoggedAction({ db, actor }: Ctx, input: unknown): string {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("action");
  const fields = parseLoggedFields(input);
  const [column, table] = input.applicationId !== undefined ? ["application_id", "applications"] : ["member_id", "profiles"];
  const subject = str(input.applicationId ?? input.memberId, "action", 64);
  if (!db.prepare(`select 1 from ${table} where id = ?`).get(subject)) throw bad("action");
  return tx(db, () => {
    const id = (db.prepare(`insert into logged_actions (${column}, author_id, kind, action_date, note) values (?, ?, ?, ?, ?) returning id`)
      .get(subject, me.id, fields.kind, fields.action_date, fields.note) as { id: string }).id;
    appendLoggedEvent(db, id, me.id, "created", fields);
    return id;
  });
}

/** Edit kind / date / note. "Nothing changed" and edits on a removed row are 409. */
export function editLoggedAction({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("action");
  const id = str(input.id, "action", 64);
  const fields = parseLoggedFields(input);
  tx(db, () => {
    const row = db.prepare("select kind, action_date, note, removed_at from logged_actions where id = ?").get(id) as
      | { kind: LoggedActionKind; action_date: string; note: string; removed_at: string | null } | undefined;
    if (!row) throw bad("action");
    if (row.removed_at) throw new AccessError("Already removed.", 409);
    if (row.kind === fields.kind && row.action_date === fields.action_date && row.note === fields.note) {
      throw new AccessError("Nothing changed.", 409);
    }
    db.prepare("update logged_actions set kind = ?, action_date = ?, note = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
      .run(fields.kind, fields.action_date, fields.note, id);
    appendLoggedEvent(db, id, me.id, "edited", fields);
  });
}

/** Soft-remove (sets removed_at). Already removed → 409. */
export function removeLoggedAction({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("action");
  const id = str(input.id, "action", 64);
  tx(db, () => {
    const row = db.prepare("select kind, action_date, note, removed_at from logged_actions where id = ?").get(id) as
      | { kind: LoggedActionKind; action_date: string; note: string; removed_at: string | null } | undefined;
    if (!row) throw bad("action");
    if (row.removed_at) throw new AccessError("Already removed.", 409);
    db.prepare("update logged_actions set removed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?").run(id);
    appendLoggedEvent(db, id, me.id, "removed", { kind: row.kind, action_date: row.action_date, note: row.note });
  });
}

/** Clear removed_at. Already active → 409. */
export function restoreLoggedAction({ db, actor }: Ctx, input: unknown): void {
  const me = requireAdmin(db, actor);
  if (!isObject(input)) throw bad("action");
  const id = str(input.id, "action", 64);
  tx(db, () => {
    const row = db.prepare("select kind, action_date, note, removed_at from logged_actions where id = ?").get(id) as
      | { kind: LoggedActionKind; action_date: string; note: string; removed_at: string | null } | undefined;
    if (!row) throw bad("action");
    if (!row.removed_at) throw new AccessError("Nothing changed.", 409);
    db.prepare("update logged_actions set removed_at = null, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?").run(id);
    appendLoggedEvent(db, id, me.id, "restored", { kind: row.kind, action_date: row.action_date, note: row.note });
  });
}

// ---------- Newsletter subscribers (CRM-093): read-only list for /admin ----------

export type NewsletterSubscriber = {
  id: string; email: string; full_name: string; source: "beehiiv" | "website"; consent: 0 | 1 | null; subscribed_at: string;
};

/** Newest first. No Beehiiv write from this card. */
export function adminNewsletterSubscribers({ db, actor }: Ctx): NewsletterSubscriber[] {
  requireAdmin(db, actor);
  return db.prepare(
    "select id, email, full_name, source, consent, subscribed_at from newsletter_subscribers order by subscribed_at desc, rowid desc",
  ).all() as NewsletterSubscriber[];
}
