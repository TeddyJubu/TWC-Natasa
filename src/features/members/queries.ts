import { queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";
import type { Database } from "@/integrations/supabase/types";
import type { MemberProfile } from "@/index";
import { toMemberProfile } from "./map";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileData = { profile: Profile; avatarUrl: string | undefined };

/** Signed URLs for private avatar files; returns a path → url map. */
export async function avatarUrls(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return {} as Record<string, string>;
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage.from("avatars").createSignedUrls(list, 60 * 60);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]),
  ) as Record<string, string>;
}

const imageFor = (path: string | null | undefined, urls: Record<string, string>) => (path ? urls[path] : undefined);

export const directoryQuery = queryOptions({
  queryKey: ["directory"],
  queryFn: async (): Promise<MemberProfile[]> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc("public_directory");
    if (error) throw error;
    if (!data?.length) return [];
    const urls = await avatarUrls(data.map((d) => d.avatar_path));
    return data.map((d) => toMemberProfile(d, { image: imageFor(d.avatar_path, urls) }));
  },
});

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<ProfileData | null> => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const urls = await avatarUrls([data.avatar_path]);
      return { profile: data, avatarUrl: imageFor(data.avatar_path, urls) };
    },
  });

export const introsQuery = (userId: string, neighborhood: string) =>
  queryOptions({
    queryKey: ["intros", userId, neighborhood],
    queryFn: async (): Promise<MemberProfile[]> => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", userId)
        .eq("status", "approved")
        .eq("directory_visible", true)
        .limit(12);
      if (error) throw error;
      if (!data?.length) return [];
      const rank = (n: string) => (n === neighborhood ? 0 : 1);
      const picked = [...data].sort((a, b) => rank(a.neighborhood) - rank(b.neighborhood)).slice(0, 4);
      const urls = await avatarUrls(picked.map((o) => o.avatar_path));
      return picked.map((o) => toMemberProfile(o, { image: imageFor(o.avatar_path, urls) }));
    },
  });
