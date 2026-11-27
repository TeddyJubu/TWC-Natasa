// The public gatherings pages' URL state and small event rules, shared by their components.
import { dayKey } from "./time";
import type { CalEvent } from "./types";

export type GatheringsView = "grid" | "list" | "calendar";
export type GatheringsSearch = { tab?: "past"; view?: "list" | "calendar"; category?: string; month?: string; q?: string; business?: string };

const short = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined);

/** The page's state lives in the URL; a default is left out so the plain address stays plain. */
export function parseGatheringsSearch(raw: Record<string, unknown>): GatheringsSearch {
  const month = typeof raw.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month) ? raw.month : undefined;
  return {
    ...(raw.tab === "past" ? { tab: "past" as const } : {}),
    ...(raw.view === "list" || raw.view === "calendar" ? { view: raw.view } : {}),
    ...(short(raw.category, 80) ? { category: short(raw.category, 80) } : {}),
    ...(month ? { month } : {}),
    ...(short(raw.q, 100) ? { q: short(raw.q, 100) } : {}),
    ...(short(raw.business, 80) ? { business: short(raw.business, 80) } : {}),
  };
}

export const isEnded = (e: Pick<CalEvent, "endTime">) => Date.parse(e.endTime) <= Date.now();
export const isFull = (e: Pick<CalEvent, "spotsLeft" | "capacity">) => e.capacity !== null && e.spotsLeft !== null && e.spotsLeft <= 0;
/** Open spots on a capped, upcoming event that isn't full yet; null when there is nothing to count. */
export const spotsLeft = (e: Pick<CalEvent, "capacity" | "spotsLeft" | "status" | "endTime">) =>
  e.capacity !== null && e.spotsLeft !== null && e.spotsLeft > 0 && e.status !== "CANCELLED" && !isEnded(e) ? e.spotsLeft : null;

/** Group a page of events by the day they happen where they happen. */
export function byEventDay<T extends Pick<CalEvent, "startTime" | "timeZone">>(events: T[]): Map<string, T[]> {
  const days = new Map<string, T[]>();
  for (const e of events) {
    const key = dayKey(e.startTime, e.timeZone);
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  return days;
}

/**
 * An event's colour field, the canvas calendar's kind chips: each category always gets the same one of eight ink-safe
 * fields (a hash of its name, so a new category in Cal needs no code), and an event with none gets stone.
 */
const KINDS = 8;
export function kindClass(category: string | null | undefined) {
  if (!category) return "twc-kind";
  let hash = 0;
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `twc-kind twc-kind--${hash % KINDS}`;
}
