import { createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Arches } from "@/app/canvas/Arches";
import { Letter } from "@/app/canvas/Letter";

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

/**
 * How joining works, true facts only (owner decisions: payment and review times are undecided, so no price, date,
 * duration or payment step): one application, read by a person and answered by email, then the welcome email on
 * approval (emailApproval), which opens her card, events and the members' directory.
 */
const JOIN_STEPS = [
  { field: "twc-c-lime", title: "Apply", text: "One form, about you and your work." },
  { field: "twc-c-butter", title: "We review", text: "Every application is read by a person. We reply by email." },
  { field: "twc-c-sky", title: "Welcome", text: "A welcome email, then your member card, events and the members’ directory." },
];

/** The design canvas's membership page: the arches, one line on price, how joining works, then the letter (#letter). */
function MembershipPage() {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Arches heading="h1" />
        <section className="twc-sec twc-sec--tight">
          <p className="twc-lede max-w-[70ch]">One price in every constellation. Women who registered before 31 December 2026 keep their free profile and map pin; the North Brooklyn Founding 50 get Member access free in 2027.</p>
        </section>
        <section aria-labelledby="joining-title">
          <div className="twc-sec twc-sec--tight">
            <div className="twc-shead mb-0">
              <h2 id="joining-title" className="twc-h2">How joining works</h2>
              <p className="twc-meta">Three steps</p>
            </div>
          </div>
          <ol className="twc-steps twc-steps--3">
            {JOIN_STEPS.map((s, i) => (
              <li key={s.title} className={`twc-tile ${s.field}`}>
                <div>
                  <span className="no">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{s.title}</h3>
                </div>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <Letter />
      </main>
      <AppFooter />
    </AppPage>
  );
}
