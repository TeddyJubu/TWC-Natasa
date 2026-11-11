import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { postApi } from "@/app/api";
import { FEED_RESIZE, resizeImage } from "@/app/resize-image";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/features/members/mutations";
import { deletePostFn, deleteReplyFn, loveFn, replyFn } from "./fns";
import type { FeedKind } from "./kinds";
import type { FeedPage, FeedPost } from "./queries";

/** Rewrites one post in every cached feed (each filter keeps its own pages); `null` takes it out. */
function patchPost(qc: QueryClient, id: string, patch: (post: FeedPost) => FeedPost | null) {
  qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["feed"] }, (data) => data && {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      posts: page.posts.flatMap((p) => (p.id === id ? [patch(p)].filter((x): x is FeedPost => x !== null) : [p])),
    })),
  });
}

export type DraftPhoto = { file: File; alt: string };
export type Draft = { kind: FeedKind; body: string; photos: DraftPhoto[] };

/** A picked photo, upright and at most 2048px a side (big enough for "open full size"), ready for photoProblem. */
export const preparePhoto = (file: File): Promise<File> => resizeImage(file, FEED_RESIZE);

/** The same checks the server makes on every photo, so a member hears about a bad file before the upload. */
export function photoProblem(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return "Please choose JPG, PNG or WebP photos.";
  if (file.size > AVATAR_MAX_BYTES) return "That photo is over 5 MB. Please choose a smaller one.";
  return null;
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, body, photos }: Draft) => {
      const form = new FormData();
      form.set("kind", kind);
      form.set("body", body);
      for (const p of photos) { form.append("photo", p.file); form.append("alt", p.alt); }
      return postApi<{ id: string }>("/api/feed", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

export function useLove(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => loveFn({ data: { postId, on } }),
    onSuccess: (loves) => patchPost(qc, postId, (p) => ({ ...p, ...loves })),
  });
}

export function useReply(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => replyFn({ data: { postId, body } }),
    onSuccess: (replies) => patchPost(qc, postId, (p) => ({ ...p, replies })),
  });
}

export function useDeleteReply(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReplyFn({ data: { id } }),
    onSuccess: (replies) => patchPost(qc, postId, (p) => ({ ...p, replies })),
  });
}

/** Takes the post out at once, then refreshes (her tally and the week's count change too). */
export function useDeletePost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deletePostFn({ data: { id: postId } }),
    onSuccess: () => {
      patchPost(qc, postId, () => null);
      return qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
