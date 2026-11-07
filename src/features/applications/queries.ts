import { queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";

export type Applicant = { email: string; fullName: string };

const nameFrom = (metadata: Record<string, unknown> | undefined) => {
  const name = metadata?.full_name ?? metadata?.name;
  return typeof name === "string" ? name.trim() : "";
};

/** The signed-in applicant's name and email for prefilling /join; null when signed out. */
export const applicantQuery = queryOptions({
  queryKey: ["applicant"],
  queryFn: async (): Promise<Applicant | null> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const user = data.session?.user;
    if (!user) return null;
    let fullName = nameFrom(user.user_metadata);
    if (!fullName) {
      // Best effort: a profile that can't be read just means no name to prefill.
      const profile = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      fullName = profile.error ? "" : (profile.data?.full_name ?? "").trim();
    }
    return { email: user.email ?? "", fullName };
  },
});
