// The feed's wording: when a post went up, and who loved it. Dates are New York days, wherever the reader is.
const TZ = "America/New_York";
const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // 2026-11-11
const daysBetween = (a: Date, b: Date) => Math.round((Date.parse(day(b)) - Date.parse(day(a))) / 86_400_000);

/** "Just now", "12m", "3h", then by New York day: "Yesterday", "Monday" (this week), "Nov 3", "Nov 3, 2025". */
export function postedAgo(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  const days = daysBetween(then, now);
  if (days <= 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });
  const sameYear = then.toLocaleDateString("en-US", { year: "numeric", timeZone: TZ }) === now.toLocaleDateString("en-US", { year: "numeric", timeZone: TZ });
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: TZ });
}

/** The full moment, for a `<time>`'s title: "Wednesday, November 11, 2026 at 3:04 PM". */
export const postedAt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: TZ });

/** "You, Cara and 21 others loved this": her first, then up to two named others; never a name the server didn't send. */
export function lovedLine(loves: number, loved: boolean, lovedBy: string[]): string {
  const names = [...(loved ? ["You"] : []), ...lovedBy].slice(0, 2);
  if (names.length === 0) return `${loves} ${loves === 1 ? "member" : "members"} loved this`;
  const others = loves - names.length;
  return others > 0 ? `${names.join(", ")} and ${others} ${others === 1 ? "other" : "others"} loved this` : `${names.join(" and ")} loved this`;
}
