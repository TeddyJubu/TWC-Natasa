import { supabase } from "@/integrations/supabase/client";

export const neighborhoods = ["Long Island City", "Astoria", "Sunnyside", "Jackson Heights", "Elmhurst", "Forest Hills", "Rego Park"] as const;

/** Signed URLs for private avatar files; returns a path → url map. */
export async function avatarUrls(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from("avatars").createSignedUrls(list, 60 * 60);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "TWC";
}
