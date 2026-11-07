import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";
import type { Booking } from "./queries";

export type HeadshotRequest = { preferred_date: string; preferred_time: string; notes: string };

export async function setRsvp(userId: string, eventId: string, going: boolean): Promise<void> {
  const supabase = await getSupabase();
  const { error } = going
    ? await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: userId })
    : await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", userId);
  if (error) throw error;
}

export async function bookHeadshot(userId: string, input: HeadshotRequest): Promise<Booking> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("headshot_bookings")
    .upsert({ user_id: userId, ...input, notes: input.notes.slice(0, 300) }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

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
