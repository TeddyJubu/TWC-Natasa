import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { StatusPage } from "@/app/layout/StatusPages";
import { openReviewFn } from "@/features/member-links/fns";
import { ReviewForm } from "@/features/member-links/ReviewForm";

/**
 * /review?t=<token>: a member's personal, single-use review link (OPS-019–022). The token is the credential: no
 * sign-in. Any token that doesn't open the form gets the same 404 (OPS-027). Opening never uses the link up.
 */
export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>): { t?: string } => (typeof search.t === "string" ? { t: search.t } : {}),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ deps }) => {
    const prefill = deps.t ? await openReviewFn({ data: { token: deps.t } }) : null;
    if (!prefill) throw notFound();
    return { token: deps.t!, prefill };
  },
  // Loaded once: after the review is sent the link is used, and a reload (e.g. on sign-in) would swap the thank-you for a 404.
  shouldReload: false,
  head: () => ({
    meta: [
      { title: "Member review — The Women’s Collective" },
      { name: "robots", content: "noindex" },
      // The URL carries the token: never send it on as a referrer.
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  notFoundComponent: InvalidLink,
  component: ReviewPage,
});

function InvalidLink() {
  return (
    <StatusPage
      script="member review"
      tilt="-rotate-2"
      title="This link isn’t valid."
      intro="This personal review link is invalid, expired, or has already been used. For your privacy, every member link opens only one time and only for one person. If you believe this is your review link and something went wrong, reply to your invitation email and we will send a fresh one."
    >
      {null}
    </StatusPage>
  );
}

function ReviewPage() {
  const { token, prefill } = Route.useLoaderData();
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="twc-wrap flex max-w-[960px] flex-col gap-8 pb-[104px] pt-14 outline-none">
        <div className="flex flex-col gap-4">
          <span className="twc-eyebrow">Existing members</span>
          <h1 className="twc-h2">Member information &amp; permissions review</h1>
          <p className="max-w-[640px] text-[17px] leading-[1.65] text-sb-muted">
            Hello {prefill.firstName} — this private page shows your own record only. Confirm or correct your details, then make each choice below
            separately. Nothing publishes automatically.
          </p>
        </div>
        <ReviewForm token={token} prefill={prefill} />
      </main>
      <AppFooter />
    </AppPage>
  );
}
