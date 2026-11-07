import { queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";
import type { Database } from "@/integrations/supabase/types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type Booking = Database["public"]["Tables"]["headshot_bookings"]["Row"];

export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: async (): Promise<EventRow[]> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at");
    if (error) throw error;
    return data;
  },
});

/** Event ids the signed-in member has an RSVP for (RLS scopes the rows to them). */
export const rsvpsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["rsvps", userId],
    queryFn: async (): Promise<string[]> => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from("event_rsvps").select("event_id");
      if (error) throw error;
      return data.map((r) => r.event_id);
    },
  });

/** The member's single headshot booking, or null. Filtered by user: admins can read every booking. */
export const bookingQuery = (userId: string) =>
  queryOptions({
    queryKey: ["booking", userId],
    queryFn: async (): Promise<Booking | null> => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from("headshot_bookings").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
