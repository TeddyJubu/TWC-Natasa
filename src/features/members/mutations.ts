import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Profile, ProfileData } from "./queries";
import { removeLogoFn, saveProfileFn, uploadImageFn } from "./fns";
import type { ProfilePatch } from "./members.server";

export type { ProfilePatch };

/** Saves her own card (the server takes the id from the session). */
export const saveProfile = (_id: string, patch: ProfilePatch): Promise<Profile> => saveProfileFn({ data: patch });

// The server checks the bytes again; these give members a clear message before the upload.
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Uploads a portrait or logo to her own folder; the server points her card at it. */
async function uploadImage(file: File, kind: "avatar" | "logo"): Promise<Profile> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP image.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("That image is over 5 MB. Please choose a smaller one.");
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file);
  return uploadImageFn({ data: form });
}

export const uploadAvatar = (_id: string, file: File): Promise<Profile> => uploadImage(file, "avatar");

/** Optional business logo (0005), stored beside her portrait. */
export const uploadLogo = (_id: string, file: File): Promise<Profile> => uploadImage(file, "logo");

/** Clears the logo, then the server deletes the file. */
export const removeLogo = (_id: string, _path: string): Promise<Profile> => removeLogoFn();

const refreshDirectory = (qc: QueryClient) =>
  Promise.all(["directory", "intros", "public-profiles"].map((key) => qc.invalidateQueries({ queryKey: [key] })));

export const saveProfileMutation = (qc: QueryClient, id: string) => ({
  mutationFn: (patch: ProfilePatch) => saveProfile(id, patch),
  onSuccess: (profile: Profile) => {
    qc.setQueryData<ProfileData | null>(["profile", id], (prev) => (prev ? { ...prev, profile } : prev));
    return refreshDirectory(qc);
  },
});

// Invalidate rather than write: a new portrait or logo path means a new image URL.
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
