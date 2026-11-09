// Member review link server functions (see src/features/members/fns.ts for the pattern). The admin ones start with
// requireAdmin; openReviewFn needs no session (the token is the credential). The review itself is POST /api/review.
import { createServerFn } from "@tanstack/react-start";

const pass = <T,>(input: unknown) => input as T;

export const mintReviewLinkFn = createServerFn({ method: "POST" })
  .validator(pass<{ member_id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
    return serve((c) => m.mintReviewLink(c, data));
  });

export const revokeReviewLinkFn = createServerFn({ method: "POST" })
  .validator(pass<{ member_id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
    return serve((c) => m.revokeReviewLink(c, data));
  });

export const reviewLinkStatesFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
  return serve(m.reviewLinkStates);
});

export const adminReviewsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
  return serve(m.adminReviews);
});

export const markReviewDoneFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
    return serve((c) => m.markReviewDone(c, data));
  });

// POST, so the token travels in the body rather than another URL.
export const openReviewFn = createServerFn({ method: "POST" })
  .validator(pass<{ token: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
    return serve((c) => m.openReview(c, data));
  });
