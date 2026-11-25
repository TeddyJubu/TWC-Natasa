import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { StatusPage } from "@/app/layout/StatusPages";
import { openSpotlightFn } from "@/features/member-links/fns";
import { SpotlightForm } from "@/features/member-links/SpotlightForm";
import { INVALID_SPOTLIGHT } from "@/features/member-links/spotlight";

/**
 * /spotlight?t=<token>: a member's personal, single-use Weekly Spotlight link (OPS-028), the old intake's path so
 * cutover redirects keep the query. The token is the credential: no sign-in. Any token that doesn't open the form
 * (a review token included) gets the same 404. Opening never uses the link up.
 */
export const Route = createFileRoute("/spotlight")({
  validateSearch: (search: Record<string, unknown>): { t?: string } => (typeof search.t === "string" ? { t: search.t } : {}),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ deps }) => {
    const prefill = deps.t ? await openSpotlightFn({ data: { token: deps.t } }) : null;
    if (!prefill) throw notFound();
    return { token: deps.t!, prefill };
  },
  // Loaded once: after the answers are sent the link is used, and a reload would swap the thank-you for a 404.
  shouldReload: false,
  head: () => ({
    meta: [
      { title: "Weekly Spotlight — The Women’s Collective" },
      { name: "robots", content: "noindex" },
      // The URL carries the token: never send it on as a referrer.
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  notFoundComponent: InvalidLink,
  component: SpotlightPage,
});

function InvalidLink() {
  return <StatusPage bare script="weekly spotlight" tilt="-rotate-2" title="This link isn’t valid." intro={INVALID_SPOTLIGHT}>{null}</StatusPage>;
}

function SpotlightPage() {
  const { token, prefill } = Route.useLoaderData();
  return (
    <AppPage>
      <AppNav bare />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="twc-phd">
          <div className="twc-fhead">
            <span className="twc-eyebrow">Weekly Spotlight</span>
            <h1 className="twc-display">Your member Spotlight</h1>
            <p className="twc-lede">
              Hello {prefill.firstName} — thank you for being part of The Women’s Collective. Tell us your story in your own words — we’ll check
              with you before anything is published.
            </p>
          </div>
        </div>
        <div className="twc-fbody">
          <SpotlightForm token={token} prefill={prefill} />
        </div>
      </main>
      <AppFooter bare />
    </AppPage>
  );
}
