import { createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Bands } from "@/app/canvas/Bands";

const TITLE = "Constellations — The Women’s Collective";
const DESCRIPTION = "One collective, five local worlds: North Brooklyn, Western Queens, Brownstone Brooklyn, Uptown and Downtown Manhattan.";

export const Route = createFileRoute("/constellations")({
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
  component: ConstellationsPage,
});

/** The design canvas's constellations page: its page head, then the five bands. */
function ConstellationsPage() {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-phd">
          <div className="min-w-0">
            <span className="twc-eyebrow">Neighborhoods</span>
            <h1 className="twc-display">Five <i>Constellations</i></h1>
            <p className="twc-lede">
              One collective, five local worlds.<br />Each constellation has its own neighborhood feed, <br className="max-[700px]:hidden" />member directory, chat rooms and ambassador.
              <span className="mt-2.5 block">Every member belongs to one home constellation.<br />Business members connect across all five.</span>
            </p>
          </div>
        </section>
        <Bands cardHeading="h2" />
      </main>
      <AppFooter />
    </AppPage>
  );
}
