// Admin reads (§2.7). RLS lets admins read every application, profile, neighborhood and booking,
// so there is no admin RPC: joins happen client-side.
import { queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";
import type { Database } from "@/integrations/supabase/types";
import type { Profile } from "@/features/members/queries";
import { attachEmails, sortApplications } from "./format";

type Tables = Database["public"]["Tables"];
export type AdminApplication = Tables["applications"]["Row"];
export type AdminMember = Profile & { email: string | null };
export type AdminNeighborhood = Tables["neighborhoods"]["Row"] & { logoUrl: string | null };
export type AdminBooking = Tables["headshot_bookings"]["Row"];

export const adminApplicationsQuery = queryOptions({
  queryKey: ["admin", "applications"],
  queryFn: async (): Promise<AdminApplication[]> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("applications").select("*");
    if (error) throw error;
    return sortApplications(data);
  },
});

/** Every profile, with the email from her linked application when there is one. Sorted by name. */
export const adminMembersQuery = queryOptions({
  queryKey: ["admin", "members"],
  queryFn: async (): Promise<AdminMember[]> => {
    const supabase = await getSupabase();
    const [profiles, emails] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("applications").select("user_id, email"),
    ]);
    if (profiles.error) throw profiles.error;
    if (emails.error) throw emails.error;
    return attachEmails(profiles.data, emails.data).sort((a, b) => a.full_name.localeCompare(b.full_name));
  },
});

/** All neighborhoods, inactive ones included, in display order. */
export const adminNeighborhoodsQuery = queryOptions({
  queryKey: ["admin", "neighborhoods"],
  queryFn: async (): Promise<AdminNeighborhood[]> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("neighborhoods").select("*").order("sort_order");
    if (error) throw error;
    // A replaced logo keeps its `<slug>.<ext>` name, so a per-fetch version stops the browser reusing the old
    // image; every save refetches this query.
    // ponytail: the ?v= only beats the browser cache. Storage's CDN may still serve the old object for up to the
    // upload's cacheControl (60s), and visitors' public neighborhoodsQuery has no version; add an updated_at
    // column to version both if a minute's lag ever matters.
    const version = Date.now();
    return data.map((row) => ({
      ...row,
      logoUrl: row.logo_path
        ? `${supabase.storage.from("neighborhood-logos").getPublicUrl(row.logo_path).data.publicUrl}?v=${version}`
        : null,
    }));
  },
});

/** Every headshot booking, soonest preferred date first. */
export const adminBookingsQuery = queryOptions({
  queryKey: ["admin", "bookings"],
  queryFn: async (): Promise<AdminBooking[]> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("headshot_bookings").select("*").order("preferred_date");
    if (error) throw error;
    return data;
  },
});
