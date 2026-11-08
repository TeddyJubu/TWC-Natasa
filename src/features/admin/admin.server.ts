// Server-only: /admin. Every function starts with requireAdmin (the old is_admin() policies).
import type { Ctx } from "@/server/context.server";
import { tx } from "@/server/db";
import { requireAdmin } from "@/server/guard";
import { checkImage, removeMedia, writeMedia } from "@/server/media";
import { bad, isObject, oneOf, str, type Json } from "@/server/validate";
import { toProfile, type MembershipStatus, type Profile } from "@/features/members/members.server";
import type { Booking } from "@/features/events/events.server";
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
