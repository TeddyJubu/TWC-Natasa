/** The kinds an admin can pick; any stored kind still renders through kindLabel. */
export const EVENT_KINDS = ["gathering", "supper", "headshots", "workshop"] as const;
export const kindLabel = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

/** Gatherings happen in Queens, so their day and time are always shown in New York time. */
const EVENT_TZ = "America/New_York";

export function eventWhen(iso: string) {
  const d = new Date(iso);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-US", { timeZone: EVENT_TZ, ...o });
  return {
    month: part({ month: "short" }), day: part({ day: "numeric" }), weekday: part({ weekday: "short" }),
    time: part({ hour: "numeric", minute: "2-digit" }),
  };
}

const nyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

/** New York's wall-clock time at instant `ms`, written as if it were UTC (so two of them subtract to an offset). */
function nyWall(ms: number): number {
  const p = Object.fromEntries(nyParts.formatToParts(ms).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}

/** A `datetime-local` value ("2026-11-14T10:00") read as New York time, as a UTC ISO string; null if malformed. */
export function nyLocalToISO(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(local);
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = target - (nyWall(target) - target);
  t += target - nyWall(t); // a second pass settles a guess that landed across a DST change
  return new Date(t).toISOString();
}

/** The inverse, for a `datetime-local` default: an ISO instant as New York wall-clock "YYYY-MM-DDTHH:mm". */
export function isoToNyLocal(iso: string): string {
  return new Date(nyWall(Date.parse(iso))).toISOString().slice(0, 16);
}

/** Today's date (YYYY-MM-DD) on the viewer's own calendar, for `<input type="date" min>`. */
export function localDateISO(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
