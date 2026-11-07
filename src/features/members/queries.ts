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

export type Viewer = { signedIn: boolean; member: boolean };

/** Who is looking: signed out, signed in but not approved, or an approved member (is_member()). */
export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: async (): Promise<Viewer> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return { signedIn: false, member: false };
    const member = await supabase.rpc("is_member");
    if (member.error) throw member.error;
    return { signedIn: true, member: member.data === true };
  },
});

/** Opted-in public cards (§2.10). public_profiles() returns no id, so cards are keyed by catalogue number. */
export const publicProfilesQuery = queryOptions({
  queryKey: ["public-profiles"],
  queryFn: async (): Promise<MemberProfile[]> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc("public_profiles");
    if (error) throw error;
    if (!data?.length) return [];
    const urls = await avatarUrls(data.map((d) => d.avatar_path));
    return data.map((d) =>
      toMemberProfile({ ...d, id: `catalogue-${d.catalogue_number}` }, { image: imageFor(d.avatar_path, urls) }),
    );
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

const INTROS = 4;

/** Up to four approved, listed members: the database returns same-neighborhood ones first (T15). */
export const introsQuery = (userId: string, neighborhood: string) =>
  queryOptions({
    queryKey: ["intros", userId, neighborhood],
    queryFn: async (): Promise<MemberProfile[]> => {
      const supabase = await getSupabase();
      const others = () =>
        supabase.from("profiles").select("*").neq("id", userId).eq("status", "approved").eq("directory_visible", true);
      const near = await others().eq("neighborhood", neighborhood).order("catalogue_number").limit(INTROS);
      if (near.error) throw near.error;
      let picked = near.data;
      if (picked.length < INTROS) {
        const rest = await others().neq("neighborhood", neighborhood).order("catalogue_number").limit(INTROS - picked.length);
        if (rest.error) throw rest.error;
        picked = [...picked, ...rest.data];
      }
      if (!picked.length) return [];
      const urls = await avatarUrls(picked.map((o) => o.avatar_path));
      return picked.map((o) => toMemberProfile(o, { image: imageFor(o.avatar_path, urls) }));
    },
  });
