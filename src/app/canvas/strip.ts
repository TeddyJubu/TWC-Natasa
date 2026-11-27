import type { RosterMember } from "@/features/roster/queries";

/** Up to eight portraits, taking turns between the constellations so both areas show; the founder leads North Brooklyn
 *  and is named there, so the strip is the members. */
export function stripMembers(members: RosterMember[], n = 8): RosterMember[] {
  const groups = new Map<string, RosterMember[]>();
  for (const m of members) if (!m.founder) groups.set(m.constellation, [...(groups.get(m.constellation) ?? []), m]);
  const out: RosterMember[] = [];
  const lists = [...groups.values()];
  for (let i = 0; out.length < n && lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length && out.length < n) out.push(l[i]);
  return out;
}
