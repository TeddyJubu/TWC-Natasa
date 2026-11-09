// Member review links on the client: admin reads and writes (requireAdmin on the server), and the token holder's
// POST /api/review. The minted URL lives only in the mint mutation's result: shown once, never cached or refetched.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { postApi } from "@/app/api";
import { adminReviewsFn, adminSpotlightsFn, markReviewDoneFn, mintReviewLinkFn, reviewLinkStatesFn, revokeReviewLinkFn } from "./fns";
import type { ReviewAnswers } from "./schema";
import type { Purpose } from "./member-links.server";

export type { AdminReview, LinkState, MintedLink, Purpose, ReviewPrefill } from "./member-links.server";
export type { AdminSpotlight, SpotlightPrefill } from "./spotlight.server";

/** Each member's newest link of that kind and its state, by member id. */
export const linkStatesQuery = (purpose: Purpose) =>
  queryOptions({ queryKey: ["admin", `${purpose}-links`], queryFn: () => reviewLinkStatesFn({ data: { purpose } }) });
export const reviewLinkStatesQuery = linkStatesQuery("review");
export const spotlightLinkStatesQuery = linkStatesQuery("spotlight");

/** Every Spotlight answer (sent and imported), newest first. */
export const adminSpotlightsQuery = queryOptions({ queryKey: ["admin", "spotlights"], queryFn: () => adminSpotlightsFn() });

/** Reviews still waiting for a person, newest first. */
export const adminReviewsQuery = queryOptions({ queryKey: ["admin", "reviews"], queryFn: () => adminReviewsFn() });

export function useMintReviewLink(purpose: Purpose = "review") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member_id: string) => mintReviewLinkFn({ data: { member_id, purpose } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", `${purpose}-links`] }),
  });
}

export function useRevokeReviewLink(purpose: Purpose = "review") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member_id: string) => revokeReviewLinkFn({ data: { member_id, purpose } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", `${purpose}-links`] }),
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

export type SpotlightSubmission = Record<string, string> & { token: string; honeypot: string };
export const sendSpotlight = (input: SpotlightSubmission) => postApi<void>("/api/spotlight", input);
