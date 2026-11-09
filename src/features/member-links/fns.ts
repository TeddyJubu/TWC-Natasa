// Member review link server functions (see src/features/members/fns.ts for the pattern). The admin ones start with
// requireAdmin; openReviewFn / openSpotlightFn need no session (the token is the credential). Answers go to
// POST /api/review and POST /api/spotlight. `purpose` picks the review (default) or Spotlight link.
import { createServerFn } from "@tanstack/react-start";

const pass = <T,>(input: unknown) => input as T;

type LinkInput = { member_id: string; purpose?: "review" | "spotlight" };

export const mintReviewLinkFn = createServerFn({ method: "POST" })
  .validator(pass<LinkInput>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
    return serve((c) => m.mintReviewLink(c, data));
  });

export const revokeReviewLinkFn = createServerFn({ method: "POST" })
  .validator(pass<LinkInput>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
    return serve((c) => m.revokeReviewLink(c, data));
  });

export const reviewLinkStatesFn = createServerFn()
  .validator(pass<{ purpose?: "review" | "spotlight" }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./member-links.server")]);
    return serve((c) => m.reviewLinkStates(c, data));
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

export const adminSpotlightsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./spotlight.server")]);
  return serve(m.adminSpotlights);
});

export const openSpotlightFn = createServerFn({ method: "POST" })
  .validator(pass<{ token: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./spotlight.server")]);
    return serve((c) => m.openSpotlight(c, data));
  });
