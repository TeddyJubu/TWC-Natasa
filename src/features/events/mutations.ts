import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Booking } from "./queries";
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

export const useToggleRsvp = (userId: string) => useMutation(toggleRsvpMutation(useQueryClient(), userId));
export const useBookHeadshot = (userId: string) => useMutation(bookHeadshotMutation(useQueryClient(), userId));
