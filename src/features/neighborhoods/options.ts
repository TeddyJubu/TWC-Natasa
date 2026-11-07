import type { Neighborhood } from "./queries";

/**
 * Names to offer in a neighborhood picker: active ones in list order, then any current value(s) that are
 * inactive or unknown, so a member or listing that still uses one keeps it selectable.
 */
export function pickerNames(list: Neighborhood[], current: string | string[] = []): string[] {
  const names = list.filter((n) => n.active).map((n) => n.name);
  for (const value of typeof current === "string" ? [current] : current) {
    if (value && !names.includes(value)) names.push(value);
  }
  return names;
}
