import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { StatusPage } from "@/app/layout/StatusPages";
import { CLOSED_TITLE } from "@/features/forms-state/constants";
import { publicFormStateFn } from "@/features/forms-state/fns";
import { FormCopyProvider } from "@/features/form-copy/FormCopy";
import { loadFormCopy } from "@/features/form-copy/queries";
import { paragraphs } from "@/features/forms/schema";
import { openReviewFn } from "@/features/member-links/fns";
import { ReviewForm } from "@/features/member-links/ReviewForm";

/**
 * /review?t=<token>: a member's personal, single-use review link (OPS-019–022). The token is the credential: no
 * sign-in. Any token that doesn't open the form gets the same 404 (OPS-027). Opening never uses the link up.
 * When reviews are closed (OPS-081), a still-valid link resolves to 200 with closed words (not a 404).
 */
export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>): { t?: string } => (typeof search.t === "string" ? { t: search.t } : {}),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ deps }) => {
    const prefill = deps.t ? await openReviewFn({ data: { token: deps.t } }) : null;
    if (!prefill) throw notFound();
    const [state, copy] = await Promise.all([publicFormStateFn({ data: { kind: "review" } }), loadFormCopy("review")]);
    return { token: deps.t!, prefill, closed: state.closed, copy };
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
  const { token, prefill, closed, copy } = Route.useLoaderData();
  const t = (text: string) => copy?.[text] ?? text;
  if (closed) {
    const [first = "", ...rest] = paragraphs(closed);
    return (
      <StatusPage bare script="closed for now" tilt="-rotate-2" title={CLOSED_TITLE.review} intro={first}>
        {rest.map((p, i) => <p key={i} className="max-w-[40ch] text-sb-muted">{p}</p>)}
      </StatusPage>
    );
  }
  return (
    <AppPage>
      <AppNav bare />
      <FormCopyProvider copy={copy}>
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="twc-phd">
          <div className="twc-fhead">
            <span className="twc-eyebrow">{t("Existing members")}</span>
            <h1 className="twc-display">{t("Member information & permissions review")}</h1>
            <p className="twc-lede">
              {t("Hello {name} — this private page shows your own record only. Confirm or correct your details, then make each choice below separately. Nothing publishes automatically.").replace("{name}", prefill.firstName)}
            </p>
          </div>
        </div>
        <div className="twc-fbody">
          <ReviewForm token={token} prefill={prefill} />
        </div>
      </main>
      </FormCopyProvider>
      <AppFooter bare />
    </AppPage>
  );
}
