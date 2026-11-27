// Server-only: telling the people on an event (Going, Maybe, the waitlist) that it was cancelled or moved. Cal keeps
// the RSVPs but writes to no one when an admin changes a community event, so the site does. Plain text, one email per
// person, each through sendEmail(); a failed send is logged and never undoes the change.
import { appUrl, sendEmail } from "@/server/email";
import { firstName, oneLine } from "@/server/notify";
import { formatRange } from "./time";

export type EventFacts = { title: string; slug: string; startTime: string; endTime: string; timeZone: string; location: string | null };
export type Recipient = { name: string; email: string };

const when = (e: EventFacts) => formatRange(e.startTime, e.endTime, e.timeZone, "en-US");
const page = (e: EventFacts) => `${appUrl()}/events/${encodeURIComponent(e.slug)}`;
const FOOTER = "You're getting this because you RSVP'd to this event or joined its waitlist.\n\nThe Women's Collective\n";

/** An admin's note, kept as written but without control characters, and short. */
export const cleanNote = (note: unknown) =>
  typeof note === "string" ? note.replace(/[^\P{Cc}\n]/gu, "").trim().slice(0, 1000) : "";

/** What moved: only the time and the place matter to someone who is coming. */
export function changedFacts(before: EventFacts, after: EventFacts): boolean {
  return Date.parse(before.startTime) !== Date.parse(after.startTime) || Date.parse(before.endTime) !== Date.parse(after.endTime)
    || (before.location ?? "").trim() !== (after.location ?? "").trim();
}

export function cancelledMail(e: EventFacts, to: Recipient, note: string) {
  return {
    to: to.email,
    subject: oneLine(`Cancelled: ${e.title}`),
    text: `Hi ${firstName(to.name)},\n\n${oneLine(e.title)} (${when(e)}) has been cancelled.\n\n${note ? `${note}\n\n` : ""}`
      + `Sorry to miss you there. Here's what else is coming up: ${appUrl()}/events\n\n${FOOTER}`,
  };
}

export function changedMail(before: EventFacts, after: EventFacts, to: Recipient) {
  const place = (after.location ?? "").trim();
  return {
    to: to.email,
    subject: oneLine(`New details: ${after.title}`),
    text: `Hi ${firstName(to.name)},\n\n${oneLine(after.title)} has new details.\n\n`
      + `When: ${when(after)}\n${place ? `Where: ${oneLine(place)}\n` : ""}\n`
      + `It was: ${when(before)}${(before.location ?? "").trim() ? `, ${oneLine(before.location!.trim())}` : ""}\n\n`
      + `Your answer still stands. If you can't make it now, change it on the event page: ${page(after)}\n`
      + `If you saved it to your calendar, add it again from there so the time is right.\n\n${FOOTER}`,
  };
}

/** Each address once, case-insensitively, first name seen wins. */
export function uniqueRecipients(people: Recipient[]): Recipient[] {
  const seen = new Map<string, Recipient>();
  for (const p of people) {
    const key = p.email.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, { name: p.name, email: key });
  }
  return [...seen.values()];
}

/** Sends in the background, one at a time; the caller answers the admin without waiting for every inbox. */
export function sendAll(mails: { to: string; subject: string; text: string }[], what: string): void {
  void (async () => {
    let failed = 0;
    for (const mail of mails) if (!(await sendEmail(mail).catch(() => ({ sent: false }))).sent) failed++;
    if (failed) console.error(`[cal] ${what}: ${failed} of ${mails.length} emails not sent`);
  })();
}
