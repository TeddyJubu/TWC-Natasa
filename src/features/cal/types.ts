// The Cal integration's shapes and field rules, shared by the browser and the server. No secrets, no server imports.

export const RSVP_STATUSES = ["GOING", "MAYBE", "NOT_GOING"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const MAX_PLUS_ONES = 10;
export const MAX_GUESTS = 10;

/**
 * What any visitor may see of an event: an allowlist, so a new upstream field never reaches the browser by accident.
 * `coverImageUrl` is the address stored in Cal, which the admin form saves back; `coverSrc` is our same-origin copy,
 * the only one a page may put in an `<img>` (the CSP allows no other).
 */
export type CalEvent = {
  uid: string; slug: string; title: string; description: string | null; category: string | null;
  coverImageUrl: string | null; coverSrc?: string | null; startTime: string; endTime: string; timeZone: string; location: string | null;
  capacity: number | null; status: "SCHEDULED" | "CANCELLED"; host: { name: string | null; username: string | null };
  goingCount: number; maybeCount: number; spotsLeft: number | null; attendees: string[];
};
/** A detail page's event; `unlisted` puts `noindex` on the page. */
export type CalEventDetail = CalEvent & { unlisted: boolean };
/** `waiting`: how many are on its waitlist (event_waitlist), on the admin list and event page. */
export type AdminCalEvent = CalEvent & { hidden: boolean; showAttendees: boolean; waiting?: number };
export type EventList = { events: CalEvent[]; total: number; categories: string[]; host: string | null };
export type AdminEventList = { events: AdminCalEvent[]; total: number; categories: string[] };
export type EventTab = "upcoming" | "past";

export type OwnerRsvp = {
  uid: string; name: string; email: string; status: RsvpStatus; plusOnes: number; note: string | null;
  createdAt: string; updatedAt: string;
};
export type RsvpResult = { uid: string; status: RsvpStatus; plusOnes: number };
export type RsvpCode = "EVENT_FULL" | "SPOTS_OPEN" | "RSVP_EXISTS" | "RATE_LIMITED" | "NOT_FOUND" | "BAD_REQUEST" | "UNAVAILABLE";
/** A signed-in member's own answer for one event, and whether she is waiting for a place (event_waitlist, 0021). */
export type MemberEventRsvp = { status: RsvpStatus | null; plusOnes: number; waitlisted: boolean };
/** One person waiting for a place at a full event, for the admin only. */
export type WaitlistEntry = { id: number; name: string; email: string; member: boolean; createdAt: string };

export type BookingField = {
  slug: string; type: string; label: string; required: boolean; placeholder: string | null; options: string[];
};
export type PublicEventType = {
  id: number; slug: string; title: string; description: string | null; lengthInMinutes: number;
  seatsPerSlot: number | null; guestsAllowed: boolean; fields: BookingField[];
};
export type EditableEventType = PublicEventType & { hidden: boolean; showAttendeeInfo: boolean; showAvailabilityCount: boolean };
export type CalSlot = { start: string; seatsBooked: number | null; seatsRemaining: number | null; seatsTotal: number | null };
export type SlotsByDay = Record<string, CalSlot[]>;

/** What the holder of a manage link sees: their own booking, never another attendee's details. */
export type PublicBooking = {
  uid: string; seatUid: string | null; title: string; eventTypeId: number; eventTypeSlug: string | null;
  start: string; end: string; duration: number; status: string; location: string | null; hostName: string | null;
  attendeeName: string | null; timeZone: string; guestsAllowed: boolean;
};
export type BookingStatusFilter = "upcoming" | "past" | "cancelled" | "unconfirmed";
export type AdminBooking = {
  uid: string; title: string; start: string; end: string; status: string; location: string | null;
  eventTypeSlug: string | null; cancellationReason: string | null;
  attendees: { name: string; email: string; timeZone: string; notes: string | null }[]; guests: string[];
};

export type CheckResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };
const fail = <T,>(errors: Record<string, string>): CheckResult<T> => ({ ok: false, errors });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => value.length <= 254 && EMAIL.test(value);
export const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};
export const isTimeZone = (value: string) => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
export const slugify = (value: string) =>
  value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

export type RsvpInput = { name: string; email: string; status: RsvpStatus; plusOnes?: number; note?: string; rsvpUid?: string };

/** The RSVP rules from Cal's API. `plusOnes` left out keeps the stored value, so it is only sent when given. */
export function checkRsvp(raw: unknown): CheckResult<RsvpInput> {
  const input = record(raw) ?? {};
  const errors: Record<string, string> = {};
  const name = text(input.name);
  const email = text(input.email).toLowerCase();
  const status = input.status as RsvpStatus;
  if (!name) errors.name = "Please add your name.";
  else if (name.length > 120) errors.name = "That name is too long.";
  if (!isEmail(email)) errors.email = "Please enter a valid email.";
  if (!RSVP_STATUSES.includes(status)) errors.status = "Please choose going, maybe or can’t go.";
  const plus = input.plusOnes;
  if (plus !== undefined && (!Number.isInteger(plus) || (plus as number) < 0 || (plus as number) > MAX_PLUS_ONES)) {
    errors.plusOnes = `Bring between 0 and ${MAX_PLUS_ONES} guests.`;
  }
  const note = text(input.note);
  if (note.length > 1000) errors.note = "Please keep the note under 1,000 characters.";
  const rsvpUid = text(input.rsvpUid);
  if (rsvpUid && !/^[\w-]{1,64}$/.test(rsvpUid)) errors.rsvpUid = "Please start your RSVP again.";
  if (Object.keys(errors).length) return fail(errors);
  return {
    ok: true,
    value: {
      name, email, status,
      ...(plus === undefined ? {} : { plusOnes: plus as number }),
      ...(note ? { note } : {}),
      ...(rsvpUid ? { rsvpUid } : {}),
    },
  };
}

export type EventInput = {
  title: string; slug?: string; description: string | null; category: string | null; coverImageUrl: string | null;
  startTime: string; endTime: string; timeZone: string; location: string | null; capacity: number | null;
  hidden: boolean; showAttendees: boolean;
};

/** The event editor's rules, checked again on the server. Capacity against the Going count is Cal's check (a 400). */
export function checkEvent(raw: unknown): CheckResult<EventInput> {
  const input = record(raw) ?? {};
  const errors: Record<string, string> = {};
  const title = text(input.title);
  if (!title) errors.title = "Please add a title.";
  else if (title.length > 200) errors.title = "Please keep the title under 200 characters.";
  const slug = slugify(text(input.slug));
  if (text(input.slug) && !slug) errors.slug = "Use letters or numbers in the web address.";
  const description = text(input.description);
  if (description.length > 10_000) errors.description = "Please keep the description under 10,000 characters.";
  const category = text(input.category);
  if (category.length > 80) errors.category = "Please keep the category under 80 characters.";
  const coverImageUrl = text(input.coverImageUrl);
  if (coverImageUrl && !isHttpUrl(coverImageUrl)) errors.coverImageUrl = "Use an http:// or https:// image address.";
  const startTime = text(input.startTime);
  const endTime = text(input.endTime);
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (Number.isNaN(start)) errors.startTime = "Please choose a start.";
  if (Number.isNaN(end)) errors.endTime = "Please choose an end.";
  else if (!Number.isNaN(start) && end <= start) errors.endTime = "The end must be after the start.";
  const timeZone = text(input.timeZone);
  if (!isTimeZone(timeZone)) errors.timeZone = "Please choose a time zone.";
  const location = text(input.location);
  if (location.length > 300) errors.location = "Please keep the location under 300 characters.";
  const rawCapacity = input.capacity;
  const capacity = rawCapacity === null || rawCapacity === undefined || rawCapacity === "" ? null : Number(rawCapacity);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) errors.capacity = "Use a whole number, or leave it blank for unlimited.";
  if (Object.keys(errors).length) return fail(errors);
  return {
    ok: true,
    value: {
      title, ...(slug ? { slug } : {}), description: description || null, category: category || null,
      coverImageUrl: coverImageUrl || null, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(),
      timeZone, location: location || null, capacity, hidden: input.hidden === true, showAttendees: input.showAttendees !== false,
    },
  };
}

export type BookingInput = {
  eventTypeId: number; start: string; name: string; email: string; timeZone: string; notes?: string; guests: string[];
  responses: Record<string, string | string[] | boolean>;
};

export function checkBooking(raw: unknown): CheckResult<BookingInput> {
  const input = record(raw) ?? {};
  const errors: Record<string, string> = {};
  const eventTypeId = Number(input.eventTypeId);
  if (!Number.isInteger(eventTypeId) || eventTypeId < 1) errors.eventTypeId = "Please choose what to book.";
  const startMs = Date.parse(text(input.start));
  if (Number.isNaN(startMs)) errors.start = "Please choose a time.";
  const name = text(input.name);
  if (!name) errors.name = "Please add your name.";
  else if (name.length > 120) errors.name = "That name is too long.";
  const email = text(input.email).toLowerCase();
  if (!isEmail(email)) errors.email = "Please enter a valid email.";
  const timeZone = text(input.timeZone);
  if (!isTimeZone(timeZone)) errors.timeZone = "Please choose a time zone.";
  const notes = text(input.notes);
  if (notes.length > 1000) errors.notes = "Please keep the notes under 1,000 characters.";
  const guests = Array.isArray(input.guests) ? input.guests.map((g) => text(g).toLowerCase()).filter(Boolean) : [];
  if (guests.length > MAX_GUESTS) errors.guests = `You can add up to ${MAX_GUESTS} guests.`;
  else if (guests.some((g) => !isEmail(g))) errors.guests = "One of those guest emails doesn’t look right.";
  else if (new Set(guests).size !== guests.length || guests.includes(email)) errors.guests = "Each guest needs their own email.";
  const responses: BookingInput["responses"] = {};
  for (const [key, value] of Object.entries(record(input.responses) ?? {}).slice(0, 30)) {
    if (!/^[\w-]{1,64}$/.test(key)) continue;
    if (typeof value === "boolean") responses[key] = value;
    else if (typeof value === "string" && value.length <= 2000) responses[key] = value;
    else if (Array.isArray(value)) responses[key] = value.filter((v): v is string => typeof v === "string").slice(0, 30).map((v) => v.slice(0, 200));
  }
  if (Object.keys(errors).length) return fail(errors);
  return {
    ok: true,
    value: {
      eventTypeId, start: new Date(startMs).toISOString(), name, email, timeZone, guests, responses,
      ...(notes ? { notes } : {}),
    },
  };
}

export type EventTypeInput = {
  id?: number; title: string; slug: string; description: string; lengthInMinutes: number; seatsPerSlot: number | null;
  showAttendeeInfo: boolean; showAvailabilityCount: boolean;
};

export function checkEventType(raw: unknown): CheckResult<EventTypeInput> {
  const input = record(raw) ?? {};
  const errors: Record<string, string> = {};
  const id = input.id === undefined ? undefined : Number(input.id);
  if (id !== undefined && (!Number.isInteger(id) || id < 1)) errors.id = "That appointment type wasn’t found.";
  const title = text(input.title);
  if (!title) errors.title = "Please add a title.";
  const slug = slugify(text(input.slug) || title);
  if (!slug) errors.slug = "Use letters or numbers in the web address.";
  const lengthInMinutes = Number(input.lengthInMinutes);
  if (!Number.isInteger(lengthInMinutes) || lengthInMinutes < 5 || lengthInMinutes > 720) errors.lengthInMinutes = "Use a length from 5 to 720 minutes.";
  const seats = input.seatsPerSlot === null || input.seatsPerSlot === undefined || input.seatsPerSlot === "" ? null : Number(input.seatsPerSlot);
  if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 1000)) errors.seatsPerSlot = "Use 1 to 1,000 seats, or leave it blank.";
  if (Object.keys(errors).length) return fail(errors);
  return {
    ok: true,
    value: {
      ...(id === undefined ? {} : { id }), title, slug, description: text(input.description).slice(0, 2000), lengthInMinutes,
      seatsPerSlot: seats, showAttendeeInfo: input.showAttendeeInfo === true, showAvailabilityCount: input.showAvailabilityCount !== false,
    },
  };
}
