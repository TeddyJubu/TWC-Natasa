// Server-only: everything that talks to Cal. The API key stays here; what leaves is built field by field (toPublicEvent,
// toPublicBooking), so attendee emails, notes and hidden events can't reach a public page by accident.
import { CalAccounts, clientFromEnv, type CalClient } from "@teddyjubu/cal-agent-tools";
import type { Ctx } from "@/server/context.server";
import type { DB } from "@/server/db";
import { coverPath } from "@/server/covers";
import { requireAdmin, requireMember } from "@/server/guard";
import { checkSize, clientIp, HttpError, publicError, rateLimit } from "@/server/request";
import { bad, isObject, str } from "@/server/validate";
import { monthKey } from "./time";
import {
  checkBooking, checkEvent, checkEventType, checkRsvp, isEmail, isTimeZone, MAX_GUESTS, RSVP_STATUSES,
  type AdminBooking, type AdminCalEvent, type AdminEventList, type BookingField, type BookingStatusFilter, type CalEvent,
  type CalEventDetail, type CalSlot, type MemberEventRsvp, type WaitlistEntry, type CheckResult, type EditableEventType, type EventList, type EventTab, type OwnerRsvp,
  type PublicBooking, type PublicEventType, type RsvpCode, type RsvpResult, type RsvpStatus, type SlotsByDay,
} from "./types";

const REQUEST_TIMEOUT = 10_000;
const LIST_TTL = 60_000;
const PAGE = 100;
// ponytail: reads at most this many of each period into memory; page through the API when a calendar outgrows it.
const MAX_PAGES = 10;

/** A refusal the visitor can act on; `code` drives the RSVP form's states. */
export class CalError extends HttpError {
  readonly code: RsvpCode | "FORBIDDEN" | "SLOT_TAKEN";
  constructor(message: string, status: number, code: CalError["code"]) {
    super(message, status);
    this.code = code;
  }
}
const unavailable = () => new CalError("The calendar isn’t responding right now. Please try again in a moment.", 503, "UNAVAILABLE");
const notFound = (what = "That") => new CalError(`${what} wasn’t found.`, 404, "NOT_FOUND");

/** Cal's error as a typed one. Bodies can hold personal details, so only the status is ever logged. */
export function toCalError(error: unknown): CalError {
  if (error instanceof CalError) return error;
  const m = /^Cal API (\d{3}): ([\s\S]*)$/.exec((error as Error | null)?.message ?? "");
  if (!m) {
    console.error("[cal] request failed:", (error as Error | null)?.name ?? "unknown");
    return unavailable();
  }
  const status = Number(m[1]);
  const body = m[2];
  if (status === 400) {
    if (/emails_must_be_unique/i.test(body)) return new CalError("That guest is already on this booking. An address with a +tag counts as the same person.", 400, "BAD_REQUEST");
    if (/seatUid/i.test(body)) return notFound("That booking");
    if (/capacity/i.test(body)) return new CalError("Capacity can’t be lower than the number of people already going.", 400, "BAD_REQUEST");
    if (/slug/i.test(body)) return new CalError("Another event already uses that web address.", 400, "BAD_REQUEST");
    if (/cancelled or has ended/i.test(body)) return new CalError("This event has been cancelled or has ended.", 400, "BAD_REQUEST");
    if (/available|already has booking|no_available/i.test(body)) return new CalError("That time was just taken. Please pick another.", 400, "SLOT_TAKEN");
    return new CalError("Please check those details and try again.", 400, "BAD_REQUEST");
  }
  if (status === 401 || status === 403) {
    console.error("[cal] refused:", status);
    return new CalError("The calendar refused that request.", 403, "FORBIDDEN");
  }
  if (status === 404) return notFound();
  if (status === 409) {
    if (/exists/i.test(body)) return new CalError("This email has already RSVP’d.", 409, "RSVP_EXISTS");
    if (/full/i.test(body)) return new CalError("This event is full.", 409, "EVENT_FULL");
    return new CalError("That time was just taken. Please pick another.", 409, "SLOT_TAKEN");
  }
  if (status === 429) return new CalError("Too many tries. Please wait a moment and try again.", 429, "RATE_LIMITED");
  console.error("[cal] upstream status:", status);
  return unavailable();
}

type Account = { name: string | null; client: CalClient; webUrl: string | null };
type Connection = { env: string; value: CalClient | CalAccounts; webUrls: Record<string, string | undefined> };
let connection: Connection | null = null;

function connect(): Connection {
  const { CAL_API_KEY, CAL_API_URL, CAL_WEB_URL, CAL_ACCOUNTS, CAL_DEFAULT_ACCOUNT } = process.env;
  const env = JSON.stringify([CAL_API_KEY, CAL_API_URL, CAL_WEB_URL, CAL_ACCOUNTS, CAL_DEFAULT_ACCOUNT]);
  if (connection?.env === env) return connection;
  if (!CAL_API_KEY && !CAL_ACCOUNTS) throw unavailable();
  try {
    const webUrls: Connection["webUrls"] = {};
    if (CAL_ACCOUNTS) {
      for (const [name, entry] of Object.entries(JSON.parse(CAL_ACCOUNTS) as Record<string, { webUrl?: string }>)) webUrls[name] = entry.webUrl ?? CAL_WEB_URL;
    }
    connection = { env, value: clientFromEnv(process.env), webUrls };
    return connection;
  } catch {
    console.error("[cal] invalid Cal configuration");
    throw unavailable();
  }
}

/** The configured businesses by name (never their keys). Empty for a single-business setup. */
export function businesses(): string[] {
  const { value } = connect();
  return value instanceof CalAccounts ? [...value.names] : [];
}

function account(business?: string): Account {
  const { value, webUrls } = connect();
  if (value instanceof CalAccounts) {
    if (business && !value.names.includes(business)) throw notFound("That business");
    const name = business ?? value.defaultAccount;
    return { name, client: value.client(name), webUrl: webUrls[name] ?? null };
  }
  return { name: null, client: value, webUrl: process.env.CAL_WEB_URL ?? null };
}

type Options = Parameters<CalClient["request"]>[1];
type Resource = Parameters<CalClient["request"]>[0];

async function raw(acc: Account, resource: Resource, options?: Options): Promise<{ data: unknown; pagination?: { hasNextPage?: boolean; totalItems?: number } }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // ponytail: CalClient takes no AbortSignal, so a hung request is abandoned, not aborted.
    return (await Promise.race([
      acc.client.request(resource, options),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), REQUEST_TIMEOUT); }),
    ])) as { data: unknown };
  } catch (error) {
    throw toCalError(error);
  } finally {
    clearTimeout(timer);
  }
}
const call = async <T,>(acc: Account, resource: Resource, options?: Options) => (await raw(acc, resource, options)).data as T;

// ponytail: in memory, one process (like rateLimit); a restart just refetches.
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>, ttl = LIST_TTL): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>;
  if (cache.size > 500) cache.clear();
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}
/** Everything cached for one business, after any change to it. */
function invalidate(acc: Account) {
  const prefix = `${acc.name ?? ""}:`;
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}
export const clearCalCache = () => cache.clear();

export type RawEvent = CalEvent & { hidden?: boolean; showAttendees?: boolean; [key: string]: unknown };

/**
 * The public view of an event, field by field. Attendees are first names, and only when the owner shows them.
 * `coverImageUrl` stays the real address (the admin form saves it back to Cal); pages show `coverSrc`, our own copy.
 */
export function toPublicEvent(e: RawEvent, business?: string | null): CalEvent {
  return {
    uid: e.uid, slug: e.slug, title: e.title, description: e.description ?? null, category: e.category ?? null,
    coverImageUrl: e.coverImageUrl ?? null, coverSrc: coverPath(e.uid, e.coverImageUrl, business), startTime: e.startTime, endTime: e.endTime, timeZone: e.timeZone, location: e.location ?? null,
    capacity: e.capacity ?? null, status: e.status, host: { name: e.host?.name ?? null, username: e.host?.username ?? null },
    goingCount: e.goingCount ?? 0, maybeCount: e.maybeCount ?? 0, spotsLeft: e.spotsLeft ?? null,
    attendees: e.showAttendees === false ? [] : (e.attendees ?? []).map((name) => String(name).trim().split(/\s+/)[0]).filter(Boolean),
  };
}
const toAdminEvent = (e: RawEvent, business?: string | null): AdminCalEvent => ({ ...toPublicEvent(e, business), hidden: e.hidden === true, showAttendees: e.showAttendees !== false });

/** Every event of a period: the API returns at most 100 at a time. */
async function period(acc: Account, name: EventTab): Promise<RawEvent[]> {
  const out: RawEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await call<RawEvent[]>(acc, "community-events", { query: { period: name, take: PAGE, skip: page * PAGE } });
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}
const allEvents = (acc: Account) =>
  cached(`${acc.name ?? ""}:events`, async () => {
    const [upcoming, past] = await Promise.all([period(acc, "upcoming"), period(acc, "past")]);
    return [...new Map([...upcoming, ...past].map((e) => [e.uid, e])).values()];
  });

export const isPast = (e: Pick<CalEvent, "endTime">, now = Date.now()) => Date.parse(e.endTime) <= now;

export type EventFilter = { tab?: EventTab | "all"; category?: string; month?: string; q?: string; now?: number };

const fold = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const matches = (e: RawEvent, q: string) => fold([e.title, e.description, e.location, e.category].filter(Boolean).join(" ")).includes(fold(q));

/** Hidden events never pass: they are reachable only by their direct link. */
export function filterPublic(events: RawEvent[], { tab = "upcoming", category, month, q, now = Date.now() }: EventFilter): RawEvent[] {
  const direction = tab === "past" ? -1 : 1;
  return events
    .filter((e) => e.hidden !== true)
    .filter((e) => tab === "all" || (tab === "past") === isPast(e, now))
    .filter((e) => !category || e.category === category)
    .filter((e) => !q?.trim() || matches(e, q.trim()))
    .filter((e) => !month || monthKey(e.startTime, e.timeZone) === month)
    .sort((a, b) => direction * (Date.parse(a.startTime) - Date.parse(b.startTime)));
}
const categoriesOf = (events: { category: string | null }[]) =>
  [...new Set(events.flatMap((e) => (e.category?.trim() ? [e.category.trim()] : [])))].sort((a, b) => a.localeCompare(b));

const clamp = (value: unknown, fallback: number, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
};
const me = (acc: Account) => cached(`${acc.name ?? ""}:me`, () => call<{ username: string; name?: string | null }>(acc, "me"), 5 * LIST_TTL);

export type ListInput = EventFilter & { business?: string; skip?: number; take?: number };

export async function listPublicEvents(input: ListInput = {}): Promise<EventList> {
  const acc = account(input.business);
  const [events, host] = await Promise.all([allEvents(acc), me(acc).catch(() => null)]);
  const { now: _clock, ...filters } = input;
  const shown = filterPublic(events, filters);
  const skip = clamp(input.skip, 0, 100_000);
  const take = clamp(input.take, 24, PAGE) || 24;
  return {
    events: shown.slice(skip, skip + take).map((e) => toPublicEvent(e, acc.name)),
    total: shown.length,
    categories: categoriesOf(events.filter((e) => e.hidden !== true)),
    host: host?.name ?? events[0]?.host?.name ?? null,
  };
}

/** One event by slug or uid. A hidden one is reachable this way, marked `unlisted` for `noindex`. */
export async function getPublicEvent(slugOrUid: string, business?: string): Promise<CalEventDetail> {
  const acc = account(business);
  const event = (await allEvents(acc)).find((e) => e.slug === slugOrUid || e.uid === slugOrUid);
  if (!event) throw notFound("That event");
  return { ...toPublicEvent(event, acc.name), unlisted: event.hidden === true };
}

/** The cover behind `/media/covers/<uid>`: the same reach as the event page, by uid only. */
export async function coverSource(uid: string, business?: string): Promise<{ url: string; unlisted: boolean } | null> {
  const event = (await allEvents(account(business))).find((e) => e.uid === uid);
  return event?.coverImageUrl ? { url: event.coverImageUrl, unlisted: event.hidden === true } : null;
}

/** Listed events for the sitemap: never a hidden one. An unreachable calendar simply adds nothing. */
export async function sitemapEvents(): Promise<{ slug: string; updated: string }[]> {
  try {
    const events = await allEvents(account());
    return events.filter((e) => e.hidden !== true && e.status === "SCHEDULED").map((e) => ({ slug: e.slug, updated: e.startTime }));
  } catch {
    return [];
  }
}

// ---- The gatherings cards on /account, /feed and the neighborhood pages ----

export type GatheringRow = { id: string; slug: string; full: boolean; title: string; description: string; location: string; neighborhood: string; starts_at: string; kind: string };

const toGathering = (e: RawEvent): GatheringRow => ({
  id: e.uid, slug: e.slug, full: e.capacity != null && e.spotsLeft != null && e.spotsLeft <= 0, title: e.title, description: e.description ?? "", location: e.location ?? "",
  // ponytail: a Cal event's category doubles as its neighborhood; add a real field if the two ever need to differ.
  neighborhood: e.category ?? "", starts_at: e.startTime, kind: "gathering",
});
const upcomingListed = async (acc: Account, from: string) =>
  filterPublic(await allEvents(acc), { tab: "upcoming", now: Date.parse(from) || Date.now() })
    .filter((e) => e.status === "SCHEDULED" && Date.parse(e.startTime) >= (Date.parse(from) || 0));

export async function publicGatherings(from: string): Promise<GatheringRow[]> {
  return (await upcomingListed(account(), from)).map(toGathering);
}
export async function memberGatherings({ db, actor }: Ctx, from?: string): Promise<GatheringRow[]> {
  requireMember(db, actor);
  return (await upcomingListed(account(), from ?? new Date().toISOString())).map(toGathering);
}

const rsvpsOf = (acc: Account, uid: string) =>
  cached(`${acc.name ?? ""}:rsvps:${uid}`, () => call<OwnerRsvp[]>(acc, "community-events", { path: `/${encodeURIComponent(uid)}/rsvps` }));
const ownRsvp = async (acc: Account, uid: string, email: string) =>
  (await rsvpsOf(acc, uid)).find((r) => r.email.toLowerCase() === email.toLowerCase());
const memberName = (db: DB, who: { id: string; email: string }) => {
  const profile = db.prepare("select full_name from profiles where id = ?").get(who.id) as { full_name?: string } | undefined;
  return profile?.full_name?.trim() || who.email.split("@")[0];
};

/** Uids of the upcoming events she is going to. Her email is matched here; other guests never leave the server. */
export async function memberRsvps({ db, actor }: Ctx): Promise<string[]> {
  const who = requireMember(db, actor);
  const acc = account();
  // ponytail: one read per event, cached a minute; the next 20 are all these cards show.
  const events = (await upcomingListed(acc, new Date().toISOString())).slice(0, 20).filter((e) => (e.goingCount ?? 0) > 0);
  const going = await Promise.all(events.map(async (e) => ((await ownRsvp(acc, e.uid, who.email))?.status === "GOING" ? e.uid : null)));
  return going.filter((uid): uid is string => uid !== null);
}

/** Her own answer for one event (the event page): only her row leaves the server, never anyone else's. */
export async function memberEventRsvp({ db, actor }: Ctx, input: unknown): Promise<MemberEventRsvp> {
  const who = requireMember(db, actor);
  const uid = uidOf(isObject(input) ? input.eventId : undefined);
  const mine = await ownRsvp(account(), uid, who.email);
  return { status: mine?.status ?? null, plusOnes: mine?.plusOnes ?? 0, waitlisted: onWaitlist(db, uid, who.email) };
}

/**
 * A signed-in member answers for herself: always her own email, so she can't change anyone else's RSVP. `going` is
 * the /account cards' yes/no; `status` is the event page's three answers. The owner endpoint overwrites the whole
 * RSVP, so her guests and note are sent again as she left them. Going takes her off the waitlist.
 */
export async function setMemberRsvp({ db, actor }: Ctx, input: unknown): Promise<void> {
  const who = requireMember(db, actor);
  if (!isObject(input)) throw bad("RSVP");
  const status = typeof input.going === "boolean" ? (input.going ? "GOING" : "NOT_GOING") : input.status;
  if (!RSVP_STATUSES.includes(status as RsvpStatus)) throw bad("RSVP");
  const uid = uidOf(input.eventId);
  const acc = account();
  const mine = await ownRsvp(acc, uid, who.email);
  await call(acc, "community-events", {
    path: `/${encodeURIComponent(uid)}/rsvps`,
    body: {
      name: memberName(db, who), email: who.email, status,
      ...(status === "GOING" && mine?.plusOnes ? { plusOnes: mine.plusOnes } : {}), ...(mine?.note ? { note: mine.note } : {}),
    },
  });
  invalidate(acc);
  if (status === "GOING") leaveWaitlist(db, uid, who.email);
}

// ---- Waitlists (event_waitlist, 0021): Cal has no waitlist status, so who waits for a full event is kept here ----

const onWaitlist = (db: DB, uid: string, email: string) =>
  !!db.prepare("select 1 from event_waitlist where event_uid = ? and email = ?").get(uid, email.trim().toLowerCase());
function leaveWaitlist(db: DB, uid: string, email: string) {
  db.prepare("delete from event_waitlist where event_uid = ? and email = ?").run(uid, email.trim().toLowerCase());
}

/**
 * A place on the waitlist exists only while the event is scheduled, ahead and full. The event is read fresh: the
 * visitor has usually just been told "full" by Cal, and a minute-old copy could still show a spot. A second join with
 * the same email changes nothing, so nobody can rename someone else's place.
 */
async function joinWaitlist(db: DB, acc: Account, uid: string, person: { name: string; email: string; userId: string | null }) {
  invalidate(acc);
  const event = (await allEvents(acc)).find((e) => e.uid === uid);
  if (!event) throw notFound("That event");
  if (event.status !== "SCHEDULED" || isPast(event)) throw new CalError("This event has been cancelled or has ended.", 400, "BAD_REQUEST");
  if (event.capacity == null || event.spotsLeft == null || event.spotsLeft > 0) {
    throw new CalError("There are still spots open, so you can RSVP instead.", 409, "SPOTS_OPEN");
  }
  db.prepare(
    `insert into event_waitlist (event_uid, email, name, user_id) values (?, ?, ?, ?)
     on conflict (event_uid, email) do update set user_id = coalesce(event_waitlist.user_id, excluded.user_id)`,
  ).run(uid, person.email.trim().toLowerCase(), person.name.trim().slice(0, 120), person.userId);
}

/** A member joins or leaves the waitlist of a full event, as herself. */
export async function setMemberWaitlist({ db, actor }: Ctx, input: unknown): Promise<void> {
  const who = requireMember(db, actor);
  if (!isObject(input) || typeof input.on !== "boolean") throw bad("waitlist");
  const uid = uidOf(input.eventId);
  if (!input.on) return leaveWaitlist(db, uid, who.email);
  await joinWaitlist(db, account(), uid, { name: memberName(db, who), email: who.email, userId: who.id });
}

/** Who is waiting for a place, first come first, for the admin's event page. */
export function adminWaitlist({ db, actor }: Ctx, input: unknown): WaitlistEntry[] {
  requireAdmin(db, actor);
  const uid = uidOf(isObject(input) ? input.uid : undefined);
  const rows = db.prepare("select id, name, email, user_id, created_at from event_waitlist where event_uid = ? order by created_at, id").all(uid) as {
    id: number; name: string; email: string; user_id: string | null; created_at: string;
  }[];
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, member: r.user_id !== null, createdAt: r.created_at }));
}

// ---- Admin ----

const uidOf = (value: unknown) => {
  const uid = str(value, "event", 64);
  if (!/^[\w-]+$/.test(uid)) throw bad("event");
  return uid;
};
const checked = <T,>(result: CheckResult<T>): T => {
  if (result.ok) return result.value;
  throw new CalError(Object.values(result.errors)[0] ?? "Please check those details.", 400, "BAD_REQUEST");
};
const businessOf = (input: unknown) => (isObject(input) && typeof input.business === "string" && input.business ? input.business : undefined);

export function adminBusinesses({ db, actor }: Ctx): string[] {
  requireAdmin(db, actor);
  return businesses();
}

export async function adminEvents({ db, actor }: Ctx, input: unknown): Promise<AdminEventList> {
  requireAdmin(db, actor);
  const acc = account(businessOf(input));
  const tab: EventTab = isObject(input) && input.tab === "past" ? "past" : "upcoming";
  const direction = tab === "past" ? -1 : 1;
  const all = await allEvents(acc);
  const shown = all.filter((e) => (tab === "past") === isPast(e)).sort((a, b) => direction * (Date.parse(a.startTime) - Date.parse(b.startTime)));
  const skip = clamp(isObject(input) ? input.skip : 0, 0, 100_000);
  const take = clamp(isObject(input) ? input.take : 25, 25, PAGE) || 25;
  return { events: shown.slice(skip, skip + take).map((e) => toAdminEvent(e, acc.name)), total: shown.length, categories: categoriesOf(all) };
}

export async function adminEvent({ db, actor }: Ctx, input: unknown): Promise<AdminCalEvent> {
  requireAdmin(db, actor);
  const uid = uidOf(isObject(input) ? input.uid : undefined);
  const acc = account(businessOf(input));
  return toAdminEvent(await call<RawEvent>(acc, "community-events", { path: `/${encodeURIComponent(uid)}` }), acc.name);
}

export async function saveAdminEvent({ db, actor }: Ctx, input: unknown): Promise<AdminCalEvent> {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("event");
  const body = checked(checkEvent(input.event));
  const acc = account(businessOf(input));
  const uid = input.uid === undefined ? null : uidOf(input.uid);
  const saved = uid
    ? await call<RawEvent>(acc, "community-events", { path: `/${encodeURIComponent(uid)}`, method: "PATCH", body })
    : await call<RawEvent>(acc, "community-events", { body });
  invalidate(acc);
  // Create and update answer without counts, so read the full owner view back.
  return toAdminEvent(await call<RawEvent>(acc, "community-events", { path: `/${encodeURIComponent(saved.uid)}` }), acc.name);
}

export async function cancelAdminEvent({ db, actor }: Ctx, input: unknown): Promise<void> {
  requireAdmin(db, actor);
  const uid = uidOf(isObject(input) ? input.uid : undefined);
  const acc = account(businessOf(input));
  await call(acc, "community-events", { path: `/${encodeURIComponent(uid)}/cancel`, method: "POST", body: {} });
  invalidate(acc);
}

export async function adminRsvps({ db, actor }: Ctx, input: unknown): Promise<OwnerRsvp[]> {
  requireAdmin(db, actor);
  const uid = uidOf(isObject(input) ? input.uid : undefined);
  return call<OwnerRsvp[]>(account(businessOf(input)), "community-events", { path: `/${encodeURIComponent(uid)}/rsvps` });
}

/** The owner's RSVP can overwrite any guest by email, so it exists only here, behind requireAdmin. */
export async function addAdminRsvp({ db, actor }: Ctx, input: unknown): Promise<void> {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("RSVP");
  const uid = uidOf(input.uid);
  const { rsvpUid: _ignored, ...body } = checked(checkRsvp(input.rsvp));
  const acc = account(businessOf(input));
  await call(acc, "community-events", { path: `/${encodeURIComponent(uid)}/rsvps`, body });
  invalidate(acc);
  if (body.status === "GOING") leaveWaitlist(db, uid, body.email);
}

const BOOKING_FILTERS: readonly BookingStatusFilter[] = ["upcoming", "past", "cancelled", "unconfirmed"];
type RawAttendee = { name?: string; email?: string; timeZone?: string; seatUid?: string; bookingFieldsResponses?: Record<string, unknown> };
type RawBooking = {
  uid: string; title?: string; start: string; end: string; duration?: number; status: string; location?: string | null; meetingUrl?: string | null;
  eventTypeId?: number; eventType?: { id?: number; slug?: string }; hosts?: { name?: string }[]; attendees?: RawAttendee[];
  guests?: string[]; cancellationReason?: string | null; seatUid?: string;
};
/** A readable place: Cal's internal `integrations:*` values mean nothing to a guest. */
const placeOf = (b: RawBooking) => [b.meetingUrl, b.location].find((v) => v && !v.startsWith("integrations:")) ?? null;

export async function adminBookings({ db, actor }: Ctx, input: unknown): Promise<{ bookings: AdminBooking[]; hasMore: boolean }> {
  requireAdmin(db, actor);
  const acc = account(businessOf(input));
  const status = isObject(input) && BOOKING_FILTERS.includes(input.status as BookingStatusFilter) ? (input.status as BookingStatusFilter) : "upcoming";
  const take = 25;
  const skip = clamp(isObject(input) ? input.skip : 0, 0, 100_000);
  const res = await raw(acc, "bookings", { query: { status, take, skip } });
  const rows = (res.data ?? []) as RawBooking[];
  return {
    hasMore: res.pagination?.hasNextPage ?? rows.length === take,
    bookings: rows.map(toAdminBooking),
  };
}

/** Cal also lists each guest as an attendee; the admin table shows them once, under Guests. */
export function toAdminBooking(b: RawBooking): AdminBooking {
  const guests = b.guests ?? [];
  const isGuest = new Set(guests.map((g) => g.toLowerCase()));
  return {
    uid: b.uid, title: b.title ?? "Appointment", start: b.start, end: b.end, status: b.status, location: placeOf(b),
    eventTypeSlug: b.eventType?.slug ?? null, cancellationReason: b.cancellationReason || null,
    attendees: (b.attendees ?? []).filter((a) => !isGuest.has((a.email ?? "").toLowerCase())).map((a) => ({
      name: a.name ?? "", email: a.email ?? "", timeZone: a.timeZone ?? "",
      notes: typeof a.bookingFieldsResponses?.notes === "string" ? a.bookingFieldsResponses.notes : null,
    })),
    guests,
  };
}

type RawField = { slug?: string; type?: string; label?: string; required?: boolean; placeholder?: string; hidden?: boolean; isDefault?: boolean; options?: unknown[] };
type RawEventType = {
  id: number; slug: string; title: string; description?: string | null; lengthInMinutes: number; hidden?: boolean;
  disableGuests?: boolean; bookingFields?: RawField[];
  seats?: { disabled?: boolean; seatsPerTimeSlot?: number; showAttendeeInfo?: boolean; showAvailabilityCount?: boolean };
};
const seatsOf = (t: RawEventType) => (t.seats && t.seats.disabled !== true ? t.seats.seatsPerTimeSlot ?? null : null);
const optionValue = (o: unknown) => (typeof o === "string" ? o : String((o as { value?: unknown; label?: unknown }).value ?? (o as { label?: unknown }).label ?? ""));

/** Only an event type's own questions; Cal's default fields are the form's fixed ones. */
const fieldsOf = (t: RawEventType): BookingField[] =>
  (t.bookingFields ?? []).filter((f) => !f.isDefault && !f.hidden && f.slug).map((f) => ({
    slug: f.slug!, type: f.type ?? "text", label: f.label || f.slug!, required: f.required === true,
    placeholder: f.placeholder ?? null, options: (f.options ?? []).map(optionValue).filter(Boolean),
  }));

/** Built field by field: no price or currency leaves (headshot cost is undecided, so no page may name one). */
export function toPublicEventType(t: RawEventType): PublicEventType {
  const seatsPerSlot = seatsOf(t);
  return {
    id: t.id, slug: t.slug, title: t.title, description: t.description ?? null, lengthInMinutes: t.lengthInMinutes,
    seatsPerSlot,
    guestsAllowed: t.disableGuests !== true && seatsPerSlot === null, fields: fieldsOf(t),
  };
}
const rawEventTypes = async (acc: Account) => {
  const { username } = await me(acc);
  return cached(`${acc.name ?? ""}:types`, () => call<RawEventType[]>(acc, "event-types", { query: { username } }));
};

export async function listEventTypes(business?: string): Promise<PublicEventType[]> {
  return (await rawEventTypes(account(business))).filter((t) => t.hidden !== true).map(toPublicEventType);
}
export async function getEventType(slug: string, business?: string): Promise<PublicEventType> {
  const found = (await rawEventTypes(account(business))).find((t) => t.slug === slug && t.hidden !== true);
  if (!found) throw notFound("That appointment");
  return toPublicEventType(found);
}

export async function adminEventTypes({ db, actor }: Ctx, input: unknown): Promise<EditableEventType[]> {
  requireAdmin(db, actor);
  return (await rawEventTypes(account(businessOf(input)))).map((t) => ({
    ...toPublicEventType(t), hidden: t.hidden === true,
    showAttendeeInfo: t.seats?.showAttendeeInfo === true, showAvailabilityCount: t.seats?.showAvailabilityCount !== false,
  }));
}

export async function saveEventType({ db, actor }: Ctx, input: unknown): Promise<void> {
  requireAdmin(db, actor);
  if (!isObject(input)) throw bad("appointment type");
  const { id, seatsPerSlot, showAttendeeInfo, showAvailabilityCount, ...fields } = checked(checkEventType(input.eventType));
  const seats = seatsPerSlot === null ? { disabled: true } : { seatsPerTimeSlot: seatsPerSlot, showAttendeeInfo, showAvailabilityCount };
  const acc = account(businessOf(input));
  if (id) await call(acc, "event-types", { path: `/${id}`, method: "PATCH", body: { ...fields, seats } });
  else await call(acc, "event-types", { body: { ...fields, ...(seatsPerSlot === null ? {} : { seats }) } });
  invalidate(acc);
}

// ---- Booking, for visitors ----

const MAX_SLOT_RANGE = 62 * 24 * 60 * 60 * 1000;

export type SlotsInput = { eventTypeId: number; start: string; end: string; timeZone: string; bookingUid?: string; business?: string };

/** Open times by day. A seated slot's `bookingUid` is dropped: that uid is the shared key to the whole session. */
export async function getSlots(input: SlotsInput): Promise<SlotsByDay> {
  const start = Date.parse(input.start);
  const end = Date.parse(input.end);
  if (!Number.isInteger(input.eventTypeId) || Number.isNaN(start) || Number.isNaN(end) || end <= start || end - start > MAX_SLOT_RANGE) throw bad("dates");
  if (!isTimeZone(input.timeZone)) throw bad("time zone");
  const acc = account(input.business);
  const listed = (await rawEventTypes(acc)).some((t) => t.id === input.eventTypeId && t.hidden !== true);
  if (!listed) {
    const moving = input.bookingUid ? await call<RawBooking>(acc, "bookings", { path: `/${encodeURIComponent(uidOf(input.bookingUid))}` }) : null;
    if ((moving?.eventTypeId ?? moving?.eventType?.id) !== input.eventTypeId) throw notFound("That appointment");
  }
  const data = await call<Record<string, (CalSlot & { bookingUid?: string })[]>>(acc, "slots", {
    query: {
      eventTypeId: input.eventTypeId, start: new Date(start).toISOString(), end: new Date(end).toISOString(), timeZone: input.timeZone,
      ...(input.bookingUid ? { bookingUidToReschedule: uidOf(input.bookingUid) } : {}),
    },
  });
  return Object.fromEntries(Object.entries(data ?? {}).map(([day, slots]) => [day, slots.map((s) => ({
    start: s.start, seatsBooked: s.seatsBooked ?? null, seatsRemaining: s.seatsRemaining ?? null, seatsTotal: s.seatsTotal ?? null,
  }))]));
}

/**
 * The booking behind a manage link. A seated session's uid is shared by everyone in it, so it opens nothing without
 * that person's own seat id, and acting on it touches only their seat.
 */
async function ownBooking(acc: Account, uid: string, seat?: string | null): Promise<{ booking: RawBooking; attendee: RawAttendee | undefined; seatUid: string | null }> {
  const booking = await call<RawBooking>(acc, "bookings", { path: `/${encodeURIComponent(uidOf(uid))}` });
  if (!booking || Array.isArray(booking) || !booking.uid) throw notFound("That booking");
  const attendees = booking.attendees ?? [];
  if (attendees.some((a) => a.seatUid)) {
    const attendee = attendees.find((a) => a.seatUid && a.seatUid === seat);
    if (!attendee) throw notFound("That booking");
    return { booking, attendee, seatUid: attendee.seatUid! };
  }
  return { booking, attendee: attendees[0], seatUid: null };
}

export function toPublicBooking(b: RawBooking, attendee: RawAttendee | undefined, seatUid: string | null, type?: RawEventType): PublicBooking {
  return {
    uid: b.uid, seatUid, title: type?.title ?? "Your appointment", eventTypeId: b.eventTypeId ?? b.eventType?.id ?? 0, eventTypeSlug: b.eventType?.slug ?? null,
    start: b.start, end: b.end, duration: b.duration ?? Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60_000), status: b.status,
    location: placeOf(b), hostName: b.hosts?.[0]?.name ?? null, attendeeName: attendee?.name ?? null, timeZone: attendee?.timeZone ?? "America/New_York",
    guestsAllowed: seatUid === null && type?.disableGuests !== true,
  };
}

export async function getPublicBooking(uid: string, seat?: string | null, business?: string): Promise<PublicBooking> {
  const acc = account(business);
  const { booking, attendee, seatUid } = await ownBooking(acc, uid, seat);
  const types = await rawEventTypes(acc).catch(() => [] as RawEventType[]);
  return toPublicBooking(booking, attendee, seatUid, types.find((t) => t.id === (booking.eventTypeId ?? booking.eventType?.id)));
}

const bookLimit = rateLimit(5, 10 * 60_000);
const manageLimit = rateLimit(15, 10 * 60_000);
const rsvpLimit = rateLimit(10, 10 * 60_000);
const MAX_BODY = 16 * 1024;

/** Runs a body-taking Cal route: every refusal as `{ error, code }`, nothing internal. */
async function respondCal(run: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await run());
  } catch (error) {
    if (error instanceof CalError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    const safe = publicError(error) as Error & { status?: number };
    return Response.json({ error: safe.message }, { status: safe.status ?? 500 });
  }
}
const readJson = async (request: Request) => {
  checkSize(request, MAX_BODY);
  return request.json().catch(() => null) as Promise<unknown>;
};
const limited = () => new CalError("Too many tries. Please wait a few minutes and try again.", 429, "RATE_LIMITED");

/** Where the server reaches Cal's web app: privately when it can, so the visitor's IP can be passed along. */
const webBase = (acc: Account) => (process.env.CAL_WEB_PRIVATE_URL || acc.webUrl || "").replace(/\/+$/, "");

/** Cal's public RSVP endpoint, proxied. Its per-IP limit gets this visitor's IP, on top of our own limit. */
export async function sendRsvp(uid: string, input: unknown, ip: string, business?: string): Promise<RsvpResult> {
  const value = checked(checkRsvp(input));
  const acc = account(business);
  const base = webBase(acc);
  if (!base) throw unavailable();
  let response: Response;
  try {
    response = await fetch(`${base}/api/community-events/${encodeURIComponent(uidOf(uid))}/rsvp`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(ip === "unknown" ? {} : { "cf-connecting-ip": ip }) },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
  } catch {
    throw unavailable();
  }
  const body = (await response.json().catch(() => null)) as { data?: RsvpResult; error?: string } | null;
  if (response.ok && body?.data && RSVP_STATUSES.includes(body.data.status as RsvpStatus)) {
    invalidate(acc);
    return { uid: body.data.uid, status: body.data.status, plusOnes: body.data.plusOnes };
  }
  const code = String(body?.error ?? "");
  if (response.status === 409) {
    return Promise.reject(/EXISTS/i.test(code)
      ? new CalError("This email has already RSVP’d from another device.", 409, "RSVP_EXISTS")
      : new CalError("This event is full.", 409, "EVENT_FULL"));
  }
  if (response.status === 429) throw limited();
  if (response.status === 404) throw notFound("That event");
  if (response.status === 400) throw new CalError("Please check your details. This event may also have been cancelled or ended.", 400, "BAD_REQUEST");
  console.error("[cal] rsvp status:", response.status);
  throw unavailable();
}

export function rsvpRequest(request: Request, uid: string, db?: DB): Promise<Response> {
  return respondCal(async () => {
    const ip = clientIp(request.headers);
    if (!rsvpLimit(`${ip}:${uid}`)) throw limited();
    const input = await readJson(request);
    const result = await sendRsvp(uid, input, ip, businessOf(input));
    // A seat after all: her waiting place is no longer needed.
    if (db && result.status === "GOING" && isObject(input) && typeof input.email === "string") leaveWaitlist(db, uidOf(uid), input.email);
    return result;
  });
}

/** A visitor joins a full event's waitlist: the RSVP route's limit and size check, then name and email only. */
export function waitlistRequest(db: DB, request: Request, uid: string): Promise<Response> {
  return respondCal(async () => {
    const ip = clientIp(request.headers);
    if (!rsvpLimit(`${ip}:${uid}`)) throw limited();
    const input = await readJson(request);
    const { name, email } = checked(checkRsvp(isObject(input) ? { name: input.name, email: input.email, status: "MAYBE" } : {}));
    await joinWaitlist(db, account(businessOf(input)), uidOf(uid), { name, email, userId: null });
    return { waitlisted: true };
  });
}

export async function createBooking(input: unknown, business?: string): Promise<{ uid: string; seatUid: string | null }> {
  const { eventTypeId, start, name, email, timeZone, notes, guests, responses } = checked(checkBooking(input));
  const acc = account(business);
  const type = (await rawEventTypes(acc)).find((t) => t.id === eventTypeId && t.hidden !== true);
  if (!type) throw notFound("That appointment");
  // Only this type's own questions go through, without blank answers.
  // ponytail: this Cal's API refuses a number field both as a number and as a string, so its answer travels in the notes.
  // Send it as a real field once the fork's bookingFieldsResponses validation is fixed.
  const answers: Record<string, string | string[] | boolean> = {};
  const numbers: string[] = [];
  for (const field of fieldsOf(type)) {
    const answer = responses[field.slug];
    const blank = answer === undefined || answer === "" || (Array.isArray(answer) && !answer.length);
    if (field.required && (blank || answer === false)) throw new CalError(`Please answer “${field.label}”.`, 400, "BAD_REQUEST");
    if (blank) continue;
    if (field.type === "number") {
      if (typeof answer !== "string" || !Number.isFinite(Number(answer))) throw new CalError(`Please enter a number for “${field.label}”.`, 400, "BAD_REQUEST");
      numbers.push(`${field.label}: ${Number(answer)}`);
    } else answers[field.slug] = answer;
  }
  const allNotes = [notes, ...numbers].filter(Boolean).join("\n");
  const useGuests = guests.length > 0 && toPublicEventType(type).guestsAllowed;
  const booking = await call<RawBooking>(acc, "bookings", {
    body: {
      eventTypeId, start, attendee: { name, email, timeZone },
      ...(useGuests ? { guests } : {}),
      bookingFieldsResponses: { ...answers, ...(allNotes ? { notes: allNotes } : {}) },
    },
  });
  invalidate(acc);
  return { uid: booking.uid, seatUid: booking.seatUid ?? null };
}

export function bookRequest(request: Request): Promise<Response> {
  return respondCal(async () => {
    if (!bookLimit(clientIp(request.headers))) throw limited();
    const input = await readJson(request);
    return createBooking(input, businessOf(input));
  });
}

/** Reschedule, cancel or add guests: only for someone holding this booking's manage link. */
export async function manageBooking(uid: string, input: unknown, business?: string): Promise<{ uid: string; seatUid: string | null }> {
  if (!isObject(input)) throw bad("request");
  const acc = account(business);
  const seat = typeof input.seatUid === "string" ? input.seatUid : null;
  const { booking, seatUid } = await ownBooking(acc, uid, seat);
  const path = `/${encodeURIComponent(booking.uid)}`;
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  const unchanged = { uid: booking.uid, seatUid };
  if (input.action === "cancel") {
    await call(acc, "bookings", { path: `${path}/cancel`, body: { cancellationReason: reason || "Cancelled by the attendee", ...(seatUid ? { seatUid } : {}) } });
    invalidate(acc);
    return unchanged;
  }
  if (input.action === "reschedule") {
    const start = Date.parse(str(input.start, "time", 40));
    if (Number.isNaN(start)) throw bad("time");
    const body = seatUid
      ? { start: new Date(start).toISOString(), seatUid }
      : { start: new Date(start).toISOString(), ...(reason ? { reschedulingReason: reason } : {}) };
    const moved = await call<RawBooking>(acc, "bookings", { path: `${path}/reschedule`, body });
    invalidate(acc);
    return { uid: moved.uid, seatUid: moved.seatUid ?? seatUid };
  }
  if (input.action === "guests") {
    if (seatUid) throw new CalError("Group sessions are booked one seat at a time.", 400, "BAD_REQUEST");
    const emails = Array.isArray(input.guests) ? input.guests.map((g) => String(g).trim().toLowerCase()).filter(Boolean) : [];
    if (!emails.length || emails.length > MAX_GUESTS || emails.some((e) => !isEmail(e))) {
      throw new CalError(`Add between 1 and ${MAX_GUESTS} valid guest emails.`, 400, "BAD_REQUEST");
    }
    await call(acc, "bookings", { path: `${path}/guests`, body: { guests: emails.map((email) => ({ email })) } });
    return unchanged;
  }
  throw bad("request");
}

export function manageRequest(request: Request, uid: string): Promise<Response> {
  return respondCal(async () => {
    if (!manageLimit(clientIp(request.headers))) throw limited();
    const input = await readJson(request);
    return manageBooking(uid, input, businessOf(input));
  });
}
