// Everything Eve can do: each entry calls the same domain function the admin pages call, so requireAdmin and every
// validation rule still apply. A "read" answers Eve directly. A "write" only ever becomes a proposal the admin confirms.
import type { Ctx } from "@/server/context.server";
import * as admin from "@/features/admin/admin.server";
import * as cal from "@/features/cal/cal.server";
import { feed, deletePost, deleteReply } from "@/features/feed/feed.server";
import { adminFormCopy, saveFormCopy } from "@/features/form-copy/copy.server";
import { adminFormsState, setMembershipFormOpen } from "@/features/forms-state/forms-state.server";
import { adminFormResponses, deleteAdminForm, saveAdminForm, setFormOpen } from "@/features/forms/forms.server";
import { adminReviews, markReviewDone, mintReviewLink, reviewLinkStates, revokeReviewLink } from "@/features/member-links/member-links.server";
import { adminSpotlights } from "@/features/member-links/spotlight.server";
import { declineAndEmail } from "@/features/admin/decline-email.server";
import { isObject, str } from "@/server/validate";

export type EveOperation = {
  kind: "read" | "write";
  area: string;
  label: string;
  /** The input's shape, for the model. The domain function still validates it. */
  input: string;
  /** The confirm card warns that this reaches someone outside the admin team. */
  notifies?: boolean;
  /** Irreversible: the confirm card says so. */
  destructive?: boolean;
  /** The result goes to the admin's screen only (a one-time link), never to the model. */
  revealResult?: boolean;
  run: (c: Ctx, input: unknown) => unknown;
};

const read = (area: string, label: string, input: string, run: EveOperation["run"]): EveOperation => ({ kind: "read", area, label, input, run });
const write = (area: string, label: string, input: string, run: EveOperation["run"], flags: Pick<EveOperation, "notifies" | "destructive" | "revealResult"> = {}): EveOperation =>
  ({ kind: "write", area, label, input, run, ...flags });

const STATUS = `"pending" | "approved" | "declined"`;
const BUSINESS = `business?: string`;
const LOGGED = `kind: "headshot_invite" | "headshot_booked" | "headshot_done" | "email_sent" | "call" | "meeting" | "other", actionDate: "YYYY-MM-DD", note?: string`;
const EVENT = `{ title, slug?, description, category, coverImageUrl, startTime: ISO, endTime: ISO, timeZone: IANA, location, capacity: number|null, hidden: boolean, showAttendees: boolean }`;
const QUESTION = `{ key: lower_snake, type, label, required?, help?, choices?: [{ value, label }] }`;

export const EVE_OPERATIONS: Record<string, EveOperation> = {
  // People
  list_members: read("people", "List members", "{}", (c) => admin.adminMembers(c)),
  list_imported_members: read("people", "List imported members who have not signed up", "{}", (c) => admin.adminImportedMembers(c)),
  list_applications: read("people", "List applications", "{}", (c) => admin.adminApplications(c)),
  list_notes: read("people", "List private admin notes", "{}", (c) => admin.adminNotes(c)),
  list_logged_actions: read("people", "List logged actions (calls, meetings, headshots)", "{}", (c) => admin.adminLoggedActions(c)),
  list_admin_activity: read("people", "List the admin activity log", "{}", (c) => admin.adminActions(c)),
  list_newsletter_subscribers: read("people", "List newsletter subscribers", "{}", (c) => admin.adminNewsletterSubscribers(c)),
  list_member_reviews: read("people", "List member review answers", "{}", (c) => adminReviews(c)),
  list_spotlight_answers: read("people", "List Spotlight answers", "{}", (c) => adminSpotlights(c)),
  list_personal_link_states: read("people", "Show which members have active personal links", `{ purpose?: "review" | "spotlight" }`, (c, i) => reviewLinkStates(c, i)),
  review_application: write("people", "Set an application's status", `{ id, status: ${STATUS} }`, (c, i) => admin.reviewApplication(c, i)),
  set_member_status: write("people", "Set a member's status", `{ id, status: ${STATUS} }`, (c, i) => admin.setMemberStatus(c, i)),
  decline_and_email: write("people", "Decline and send the decline email", `{ kind: "application" | "member", id }`, (c, i) => declineAndEmail(c, i as Parameters<typeof declineAndEmail>[1]), { notifies: true }),
  send_approval_email: write("people", "Send the approval welcome email", `{ applicationId }`, (c, i) => admin.approvalEmail(c, str(isObject(i) ? i.applicationId : undefined, "application", 64)), { notifies: true }),
  set_member_neighborhood: write("people", "Set a member's neighborhood", `{ id, neighborhood: string|null }`, (c, i) => admin.setMemberNeighborhood(c, i)),
  add_note: write("people", "Add a private note", `{ applicationId, body } or { memberId, body }`, (c, i) => admin.addNote(c, i)),
  delete_note: write("people", "Delete a private note", `{ id }`, (c, i) => admin.deleteNote(c, i), { destructive: true }),
  add_logged_action: write("people", "Log an action", `{ applicationId or memberId, ${LOGGED} }`, (c, i) => admin.addLoggedAction(c, i)),
  edit_logged_action: write("people", "Edit a logged action", `{ id, ${LOGGED} }`, (c, i) => admin.editLoggedAction(c, i)),
  remove_logged_action: write("people", "Remove a logged action", `{ id }`, (c, i) => admin.removeLoggedAction(c, i)),
  restore_logged_action: write("people", "Restore a logged action", `{ id }`, (c, i) => admin.restoreLoggedAction(c, i)),
  mint_personal_link: write("people", "Create a personal review or Spotlight link", `{ member_id, purpose?: "review" | "spotlight" }`, (c, i) => mintReviewLink(c, i), { revealResult: true }),
  revoke_personal_link: write("people", "Revoke a personal link", `{ member_id, purpose?: "review" | "spotlight" }`, (c, i) => revokeReviewLink(c, i)),
  mark_review_done: write("people", "Mark a member review as applied", `{ id }`, (c, i) => markReviewDone(c, i)),

  // Inbox
  list_inbox: read("inbox", "List inbox messages", "{}", (c) => admin.adminInbox(c)),
  archive_message: write("inbox", "Archive an inbox message", `{ id }`, (c, i) => admin.archiveMessage(c, i)),

  // Neighborhoods
  list_neighborhoods: read("neighborhoods", "List neighborhoods", "{}", (c) => admin.adminNeighborhoods(c)),
  create_neighborhood: write("neighborhoods", "Create a neighborhood", `{ slug, name, color, sort_order: number }`, (c, i) => admin.createNeighborhood(c, i)),
  update_neighborhood: write("neighborhoods", "Update a neighborhood", `{ slug, name, color, sort_order: number, active: boolean }`, (c, i) => admin.updateNeighborhood(c, i)),

  // Events and appointments (Cal)
  list_calendars: read("events", "List connected calendars", "{}", (c) => cal.adminBusinesses(c)),
  list_events: read("events", "List events", `{ tab?: "upcoming" | "past", skip?, take?, ${BUSINESS} }`, (c, i) => cal.adminEvents(c, i)),
  get_event: read("events", "Get one event", `{ uid, ${BUSINESS} }`, (c, i) => cal.adminEvent(c, i)),
  list_event_rsvps: read("events", "List an event's RSVPs", `{ uid, ${BUSINESS} }`, (c, i) => cal.adminRsvps(c, i)),
  list_bookings: read("events", "List appointment bookings", `{ status?: "upcoming" | "past" | "cancelled" | "unconfirmed", skip?, ${BUSINESS} }`, (c, i) => cal.adminBookings(c, i)),
  list_appointment_types: read("events", "List appointment types", `{ ${BUSINESS} }`, (c, i) => cal.adminEventTypes(c, i)),
  list_headshot_requests: read("events", "List headshot requests", "{}", (c) => admin.adminBookings(c)),
  create_event: write("events", "Create an event", `{ event: ${EVENT}, ${BUSINESS} }`, (c, i) => cal.saveAdminEvent(c, isObject(i) ? { ...i, uid: undefined } : i)),
  update_event: write("events", "Update an event", `{ uid, event: ${EVENT} (send every field), ${BUSINESS} }`, (c, i) => {
    if (!isObject(i) || i.uid === undefined) throw new Error("Which event?");
    return cal.saveAdminEvent(c, i);
  }, { notifies: true }),
  cancel_event: write("events", "Cancel an event", `{ uid, ${BUSINESS} }`, (c, i) => cal.cancelAdminEvent(c, i), { notifies: true, destructive: true }),
  add_event_rsvp: write("events", "Add or change someone's RSVP", `{ uid, rsvp: { name, email, status: "GOING" | "MAYBE" | "NOT_GOING", plusOnes?, note? }, ${BUSINESS} }`, (c, i) => cal.addAdminRsvp(c, i), { notifies: true }),
  save_appointment_type: write("events", "Create or update an appointment type", `{ eventType: { id?, title, slug, description, lengthInMinutes, seatsPerSlot, showAttendeeInfo, showAvailabilityCount }, ${BUSINESS} }`, (c, i) => cal.saveEventType(c, i)),
  set_headshot_request: write("events", "Confirm or decline a headshot request", `{ id, status: "confirmed" | "declined" }`, (c, i) => admin.setBookingStatus(c, i)),

  // Forms
  list_forms: read("forms", "List custom forms with their answers", "{}", (c) => adminFormResponses(c)),
  list_membership_form_state: read("forms", "Show whether Join and Review are open", "{}", (c) => adminFormsState(c)),
  get_form_wording: read("forms", "Read a built-in form's wording", `{ form: "application" | "review" | "contact" | "partnership" }`, (c, i) => adminFormCopy(c, i)),
  save_form: write("forms", "Create or update a custom form", `{ id?, name, slug, intro?, thanks?, closed_message?, open?, one_per_email?, opens_at?, closes_at?, max_responses?, confirm?, questions: [${QUESTION}] } (for an update, send every field from list_forms)`, (c, i) => saveAdminForm(c, i)),
  set_form_open: write("forms", "Open or close a custom form", `{ id, open: boolean, message? }`, (c, i) => setFormOpen(c, i)),
  delete_form: write("forms", "Delete a custom form and all its answers", `{ id }`, (c, i) => deleteAdminForm(c, i), { destructive: true }),
  set_membership_form_open: write("forms", "Open or close Join or Review", `{ kind: "application" | "review", open: boolean, message? }`, (c, i) => setMembershipFormOpen(c, i)),
  save_form_wording: write("forms", "Change a built-in form's wording", `{ form, values: { "<default text>": "<new text>" } }`, (c, i) => saveFormCopy(c, i)),

  // Newsfeed
  read_feed: read("feed", "Read the members' newsfeed", `{ filter?: "all" | "hood" | "asks" | "gatherings", cursor?: string|null }`, (c, i) => feed(c, i)),
  delete_post: write("feed", "Delete a newsfeed post", `{ id }`, (c, i) => deletePost(c, i), { destructive: true }),
  delete_reply: write("feed", "Delete a newsfeed reply", `{ id }`, (c, i) => deleteReply(c, i), { destructive: true }),
};
