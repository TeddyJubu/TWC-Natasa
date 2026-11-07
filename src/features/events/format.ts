/** Gatherings happen in Queens, so their day and time are always shown in New York time. */
const EVENT_TZ = "America/New_York";

export function eventWhen(iso: string) {
  const d = new Date(iso);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-US", { timeZone: EVENT_TZ, ...o });
  return { month: part({ month: "short" }), day: part({ day: "numeric" }), time: part({ hour: "numeric", minute: "2-digit" }) };
}

/** Today's date (YYYY-MM-DD) on the viewer's own calendar, for `<input type="date" min>`. */
export function localDateISO(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
