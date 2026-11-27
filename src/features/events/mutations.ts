import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Booking } from "./queries";
import { setMemberWaitlistFn } from "@/features/cal/fns";
import { bookHeadshotFn, setRsvpFn } from "./fns";

export type HeadshotRequest = { preferred_date: string; preferred_time: string; notes: string };

export const setRsvp = (_userId: string, eventId: string, going: boolean): Promise<void> =>
  setRsvpFn({ data: { eventId, going } });

export const bookHeadshot = (_userId: string, input: HeadshotRequest): Promise<Booking> =>
  bookHeadshotFn({ data: { ...input, notes: input.notes.slice(0, 300) } });

export const toggleRsvpMutation = (qc: QueryClient, userId: string) => ({
  mutationFn: ({ eventId, going }: { eventId: string; going: boolean }) => setRsvp(userId, eventId, going),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["rsvps", userId] }),
});

export const bookHeadshotMutation = (qc: QueryClient, userId: string) => ({
  mutationFn: (input: HeadshotRequest) => bookHeadshot(userId, input),
  onSuccess: (booking: Booking) => qc.setQueryData(["booking", userId], booking),
});

/** A change from /account's Events card: a seat (or not), or a place on a full event's waitlist (or not). */
export type PlanChange = { eventId: string; going: boolean } | { eventId: string; waitlist: boolean };

/**
 * Sends a PlanChange as herself, then refreshes her answers everywhere (every ["rsvps", …] query, the event page's
 * too) and the events, whose "full" a seat can change — after a refusal as well, since that usually means it changed.
 */
export const planMutation = (qc: QueryClient, userId: string) => ({
  mutationFn: (change: PlanChange): Promise<void> =>
    "waitlist" in change
      ? setMemberWaitlistFn({ data: { eventId: change.eventId, on: change.waitlist } })
      : setRsvp(userId, change.eventId, change.going),
  onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ["rsvps"] }), qc.invalidateQueries({ queryKey: ["events"] })]),
});

export const useToggleRsvp = (userId: string) => useMutation(toggleRsvpMutation(useQueryClient(), userId));
export const usePlanChange = (userId: string) => useMutation(planMutation(useQueryClient(), userId));
export const useBookHeadshot = (userId: string) => useMutation(bookHeadshotMutation(useQueryClient(), userId));
