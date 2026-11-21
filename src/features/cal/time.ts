// Dates for the calendar: always through Intl with the event's own time zone, so a day never shifts with the viewer.

type Zoned = { iso: string; timeZone: string; locale?: string };

const parts = (ms: number, timeZone: string) => {
  const out = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(ms);
  return Object.fromEntries(out.map((p) => [p.type, p.value])) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
};

/** The calendar day an instant falls on in `timeZone`, as YYYY-MM-DD. */
export function dayKey(iso: string, timeZone: string): string {
  const p = parts(Date.parse(iso), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
export const monthKey = (iso: string, timeZone: string) => dayKey(iso, timeZone).slice(0, 7);

const wallMs = (ms: number, timeZone: string) => {
  const p = parts(ms, timeZone);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
};

/** A `datetime-local` value read in `timeZone`, as a UTC ISO string; null if malformed. */
export function wallToIso(local: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(local);
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = target - (wallMs(target, timeZone) - target);
  t += target - wallMs(t, timeZone); // a second pass settles a guess that landed across a DST change
  return new Date(t).toISOString();
}
/** The inverse, for a `datetime-local` default. */
export const isoToWall = (iso: string, timeZone: string) => new Date(wallMs(Date.parse(iso), timeZone)).toISOString().slice(0, 16);

export const formatDay = ({ iso, timeZone, locale }: Zoned) =>
  new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(Date.parse(iso));
export const formatTime = ({ iso, timeZone, locale }: Zoned) =>
  new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(Date.parse(iso));
/** "EST", "GMT+1": the short label for this zone at this instant. */
export function zoneLabel({ iso, timeZone, locale }: Zoned) {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(Date.parse(iso)).find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/** "Sat, Nov 28, 2026 · 6:00 – 8:00 PM EST", with the end's date when it runs past midnight. */
export function formatRange(start: string, end: string, timeZone: string, locale?: string) {
  const sameDay = dayKey(start, timeZone) === dayKey(end, timeZone);
  const from = `${formatDay({ iso: start, timeZone, locale })} · ${formatTime({ iso: start, timeZone, locale })}`;
  const to = sameDay ? formatTime({ iso: end, timeZone, locale }) : `${formatDay({ iso: end, timeZone, locale })} · ${formatTime({ iso: end, timeZone, locale })}`;
  return `${from} – ${to} ${zoneLabel({ iso: start, timeZone, locale })}`;
}

/** 0 = Sunday … 6 = Saturday: the first day of the week in this locale (Sunday where the browser can't say). */
export function firstWeekday(locale?: string): number {
  try {
    const loc = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number };
    };
    const first = loc.getWeekInfo?.().firstDay ?? loc.weekInfo?.firstDay;
    return first === undefined ? 0 : first % 7;
  } catch {
    return 0;
  }
}

/** The YYYY-MM-DD cells of a month grid (whole weeks), starting on `weekStart`. */
export function monthCells(month: string, weekStart: number): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() - weekStart + 7) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const count = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - lead + i)).toISOString().slice(0, 10));
}
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}
export const isMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** Every IANA zone the browser knows, with the given one first when it isn't listed. */
export function timeZones(current?: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["America/New_York", "UTC"];
  return current && !all.includes(current) ? [current, ...all] : all;
}
export const browserTimeZone = () => new Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

type CalendarEntry = { uid: string; title: string; description?: string | null; location?: string | null; startTime: string; endTime: string; url?: string };

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
/** RFC 5545 folds lines at 75 octets; a code point is never split. */
function fold(line: string) {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(entry: CalendarEntry, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Women's Collective//Gatherings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${entry.uid}@thewomenscollective.club`, `DTSTAMP:${icsDate(now.toISOString())}`,
    `DTSTART:${icsDate(entry.startTime)}`, `DTEND:${icsDate(entry.endTime)}`, `SUMMARY:${icsText(entry.title)}`,
    ...(entry.description ? [`DESCRIPTION:${icsText(entry.description)}`] : []),
    ...(entry.location ? [`LOCATION:${icsText(entry.location)}`] : []),
    ...(entry.url ? [`URL:${entry.url}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function googleCalendarUrl(entry: CalendarEntry): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: entry.title, dates: `${icsDate(entry.startTime)}/${icsDate(entry.endTime)}` });
  if (entry.description) params.set("details", entry.description.slice(0, 1200));
  if (entry.location) params.set("location", entry.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}
