// Member review links on the client: admin reads and writes (requireAdmin on the server), and the token holder's
// POST /api/review. The minted URL lives only in the mint mutation's result: shown once, never cached or refetched.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { postApi } from "@/app/api";
import { adminReviewsFn, markReviewDoneFn, mintReviewLinkFn, reviewLinkStatesFn, revokeReviewLinkFn } from "./fns";
import type { ReviewAnswers } from "./schema";

export type { AdminReview, LinkState, MintedLink, ReviewPrefill } from "./member-links.server";

/** Each member's newest review link and its state, by member id. */
export const reviewLinkStatesQuery = queryOptions({ queryKey: ["admin", "review-links"], queryFn: () => reviewLinkStatesFn() });

/** Reviews still waiting for a person, newest first. */
export const adminReviewsQuery = queryOptions({ queryKey: ["admin", "reviews"], queryFn: () => adminReviewsFn() });

export function useMintReviewLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member_id: string) => mintReviewLinkFn({ data: { member_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "review-links"] }),
  });
}

export function useRevokeReviewLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member_id: string) => revokeReviewLinkFn({ data: { member_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "review-links"] }),
  });
}

export function useMarkReviewDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markReviewDoneFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "reviews"] }),
  });
}

export type ReviewSubmission = ReviewAnswers & { token: string; honeypot: string };
export const sendReview = (input: ReviewSubmission) => postApi<void>("/api/review", input);
