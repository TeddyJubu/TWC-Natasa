import { createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Arches } from "@/app/canvas/Arches";

const TITLE = "Membership — The Women’s Collective";
const DESCRIPTION = "Community is free to try. Belonging is a commitment. Guest, Member, Business and Nonprofit membership in The Women’s Collective.";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembershipPage,
});

/** The design canvas's membership page: the arches, then one line on price. */
function MembershipPage() {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Arches heading="h1" />
        <section className="twc-sec twc-sec--tight">
          <p className="twc-lede max-w-[70ch]">One price in every constellation. Women who registered before 31 December 2026 keep their free profile and map pin; the North Brooklyn Founding 50 get Member access free in 2027.</p>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
