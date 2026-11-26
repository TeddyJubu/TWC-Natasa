import { queryOptions } from "@tanstack/react-query";
import { rosterFn } from "./fns";

export type { RosterMember } from "./roster.server";

/** The club's real members for the canvas's charts, cards and strips; empty for a visitor once the PIN is lifted. */
export const rosterQuery = queryOptions({ queryKey: ["roster"], queryFn: () => rosterFn(), staleTime: Infinity });
