import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";
import type { Database } from "@/integrations/supabase/types";
import type { Profile, ProfileData } from "./queries";

export type ProfilePatch = Database["public"]["Tables"]["profiles"]["Update"];

export async function saveProfile(id: string, patch: ProfilePatch): Promise<Profile> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// Mirrors the avatars bucket limits in migration 0001, so members get a clear message instead of a storage error.
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Uploads to `<id>/<kind>-<ts>.<ext>` in her own avatars folder, so the bucket's owner policies apply. */
async function uploadImage(id: string, file: File, kind: "avatar" | "logo"): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP image.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("That image is over 5 MB. Please choose a smaller one.");
  const supabase = await getSupabase();
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
  const path = `${id}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export const uploadAvatar = async (id: string, file: File): Promise<Profile> =>
  saveProfile(id, { avatar_path: await uploadImage(id, file, "avatar") });

/** Optional business logo (0005), stored beside her portrait. */
export const uploadLogo = async (id: string, file: File): Promise<Profile> =>
  saveProfile(id, { business_logo_url: await uploadImage(id, file, "logo") });

/** Clears the logo first (that's what members see), then deletes the file; a leftover file is harmless. */
export async function removeLogo(id: string, path: string): Promise<Profile> {
  const profile = await saveProfile(id, { business_logo_url: null });
  await (await getSupabase()).storage.from("avatars").remove([path]);
  return profile;
}

const refreshDirectory = (qc: QueryClient) =>
  Promise.all(["directory", "intros", "public-profiles"].map((key) => qc.invalidateQueries({ queryKey: [key] })));

export const saveProfileMutation = (qc: QueryClient, id: string) => ({
  mutationFn: (patch: ProfilePatch) => saveProfile(id, patch),
  onSuccess: (profile: Profile) => {
    qc.setQueryData<ProfileData | null>(["profile", id], (prev) => (prev ? { ...prev, profile } : prev));
    return refreshDirectory(qc);
  },
});

// Invalidate rather than write: a new portrait or logo path needs a freshly signed URL.
const refreshImages = (qc: QueryClient, id: string) =>
  Promise.all([qc.invalidateQueries({ queryKey: ["profile", id] }), refreshDirectory(qc)]);

export const uploadAvatarMutation = (qc: QueryClient, id: string) => ({
  mutationFn: (file: File) => uploadAvatar(id, file),
  onSuccess: () => refreshImages(qc, id),
});

export const useUploadLogo = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (file: File) => uploadLogo(id, file), onSuccess: () => refreshImages(qc, id) });
};
export const useRemoveLogo = (id: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (path: string) => removeLogo(id, path), onSuccess: () => refreshImages(qc, id) });
};

export const useSaveProfile = (id: string) => useMutation(saveProfileMutation(useQueryClient(), id));
export const useUploadAvatar = (id: string) => useMutation(uploadAvatarMutation(useQueryClient(), id));
