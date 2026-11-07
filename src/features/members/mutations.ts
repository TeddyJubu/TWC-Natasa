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

export async function uploadAvatar(id: string, file: File): Promise<Profile> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP image.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("That image is over 5 MB. Please choose a smaller one.");
  const supabase = await getSupabase();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  return saveProfile(id, { avatar_path: path });
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

export const uploadAvatarMutation = (qc: QueryClient, id: string) => ({
  mutationFn: (file: File) => uploadAvatar(id, file),
  // Invalidate rather than write: the new avatar path needs a freshly signed URL.
  onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["profile", id] }), refreshDirectory(qc)]),
});

export const useSaveProfile = (id: string) => useMutation(saveProfileMutation(useQueryClient(), id));
export const useUploadAvatar = (id: string) => useMutation(uploadAvatarMutation(useQueryClient(), id));
