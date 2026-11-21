// The Cal admin pages' shared state and RSVP arithmetic.
import * as React from "react";
import { toCsv } from "@/features/admin/format";
import type { OwnerRsvp, RsvpStatus } from "./types";

const KEY = "twc-cal-business";
export const STATUS_LABEL: Record<RsvpStatus, string> = { GOING: "Going", MAYBE: "Maybe", NOT_GOING: "Can’t go" };

/** Which business the admin is working on, across the Cal pages. Storage can be blocked; that only resets the choice. */
export function useAdminBusiness() {
  const [business, set] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    try { set(window.sessionStorage.getItem(KEY) ?? undefined); } catch { /* the default business */ }
  }, []);
  const setBusiness = (next?: string) => {
    set(next);
    try {
      if (next) window.sessionStorage.setItem(KEY, next);
      else window.sessionStorage.removeItem(KEY);
    } catch { /* kept for this page only */ }
  };
  return [business, setBusiness] as const;
}

export function rsvpTotals(rows: OwnerRsvp[]) {
  const going = rows.filter((r) => r.status === "GOING");
  const guests = going.reduce((n, r) => n + r.plusOnes, 0);
  return { going: going.length, guests, seats: going.length + guests, maybe: rows.filter((r) => r.status === "MAYBE").length, notGoing: rows.filter((r) => r.status === "NOT_GOING").length };
}
export const rsvpCsv = (rows: OwnerRsvp[]) =>
  toCsv(["Name", "Email", "Status", "Guests", "Note", "Answered"], rows.map((r) => [r.name, r.email, STATUS_LABEL[r.status], r.plusOnes, r.note, r.updatedAt]));
