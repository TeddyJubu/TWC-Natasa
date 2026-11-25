import type * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import aboutGathering from "@/assets/photography/site/about-gathering.webp";
import { aboutGatheringSizes, aboutGatheringSrcSet } from "@/app/responsive-images";
import natasaFounder from "@/assets/photography/home/natasa-founder.webp";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, JoinButton } from "@/app/layout/twc";
import { useNeighborhoods } from "@/features/neighborhoods/queries";

const TITLE = "About — The Women’s Collective";
const DESCRIPTION = "The Women’s Collective brings women across North Brooklyn and Queens together to meet, share knowledge, support one another’s work, and build real relationships close to home.";

export const Route = createFileRoute("/about")({
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
  component: AboutPage,
});

const STEPS = [
  { field: "twc-c-lime", title: "Introduce yourself", text: "Tell us about your work, the people you hope to meet, and how you want to contribute." },
  { field: "twc-c-butter", title: "A real person reads it", text: "We read every application. We’ll be in touch by email about next steps." },
  // Board note doubted "everything unlocks at once": list only what approval itself grants, no timing.
  { field: "twc-c-sky", title: "Get welcomed in", text: "Approval brings your catalogue number, the chance to save a seat at member events, and the choice to show your card in the directory." },
  { field: "twc-c-blush", title: "Show up", text: "Save your seat, meet the neighbors we introduce you to, and help someone else shine." },
];

const VALUES = [
  { title: "Generous", text: "Not networking for networking’s sake. We give referrals, make introductions and share what we know." },
  { title: "Local", text: "Rooted in North Brooklyn and Queens, from Greenpoint to Rego Park. Each neighborhood has its own identity and color." },
  { title: "Inclusive", text: "Women from all backgrounds, including moms, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, and international members." },
];

function AboutPage() {
  const { data: neighborhoods } = useNeighborhoods();
  const hoods = neighborhoods.filter((n) => n.active);
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-phd twc-phd--media">
          <div className="min-w-0">
            <p className="twc-eyebrow">About the collective</p>
            <h1 className="twc-display">A collective built close to home.</h1>
            <p className="twc-lede">{DESCRIPTION}</p>
            <p className="twc-chip twc-chip--ring mt-6"><Icon name="pin" />North Brooklyn and Queens, New York</p>
          </div>
          <figure className="twc-phd__media">
            <img src={aboutGathering} srcSet={aboutGatheringSrcSet} sizes={aboutGatheringSizes} alt="A group of women laughing together outdoors on a sunny day" width={1280} height={1600} fetchPriority="high" className="twc-hardphoto aspect-[4/5]" />
          </figure>
        </section>

        <section className="pb-15">
          <h2 className="twc-inline">Opportunity starts <em>with knowing</em> who’s nearby.</h2>
          <p className="twc-lede mx-auto px-(--twc-gut) text-center">When women know who is around them, they can recommend each other, collaborate, show up for each other’s events, and create opportunities that would be harder to build alone.</p>
        </section>

        <section aria-labelledby="steps-title">
          <div className="twc-sec twc-sec--tight">
            <div className="twc-shead mb-0">
              <h2 id="steps-title" className="twc-h2">From hello to neighbor in four steps.</h2>
              <p className="twc-meta">How it works<br />North Brooklyn and Queens</p>
            </div>
          </div>
          <ol className="twc-steps">
            {STEPS.map((s, i) => (
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

        <section aria-labelledby="values-title" className="twc-sec pb-0">
          <div className="twc-shead">
            <h2 id="values-title" className="twc-h2">What we value</h2>
            <p className="twc-meta">Come as you are</p>
          </div>
        </section>
        <div className="twc-cards">
          {VALUES.map((v, i) => (
            <div key={v.title} className={i === 2 ? "twc-card twc-card--dark" : "twc-card"}>
              <h3 className="twc-card__title">{v.title}</h3>
              <p>{v.text}</p>
            </div>
          ))}
        </div>

        <section aria-labelledby="founder-title" className="twc-sec">
          <div className="twc-split items-center">
            <figure className="m-0 max-w-[420px]">
              <img src={natasaFounder} alt="Portrait of Nataša Tuohy, founder of The Women’s Collective" width={800} height={800} loading="lazy" className="twc-hardphoto aspect-[4/5] w-full" />
            </figure>
            <div className="flex min-w-0 flex-col items-start gap-4.5">
              <p className="twc-eyebrow">Founder</p>
              <h2 id="founder-title" className="twc-display">Meet Nataša <em className="font-normal italic [font-stretch:100%]">(hi!)</em></h2>
              <p className="twc-measure text-[17px] leading-[1.6]">Nataša is a New York–based architectural and interior designer whose work brings European sensibility together with New York pragmatism. Educated at the University of Florence, she founded her Greenpoint studio around thoughtful spaces, trusted collaboration, and enduring relationships.</p>
              <a className="twc-btn twc-btn--outline mt-1.5" href="https://natasatuohy.com/about/" target="_blank" rel="noreferrer">
                Visit Nataša’s studio <Icon name="arrowUp" className="twc-arrow" /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>
        </section>

        <section className="twc-sec">
          <div className="twc-shead mb-0">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="twc-eyebrow">Our constellation</p>
              <h2 className="twc-h3">Every connection makes the whole community stronger</h2>
              <p className="twc-lede">The central star is the point where our neighborhoods and connections meet.</p>
              <div role="img" aria-label={`Neighborhood colors: ${hoods.map((n) => n.name).join(", ")}`} className="mt-1.5 flex flex-wrap gap-2">
                {hoods.map((n) => <span key={n.slug} title={n.name} className="twc-dot size-5 bg-(--hood) shadow-[inset_0_0_0_1px_var(--color-sb-ink)]" style={{ "--hood": n.color } as React.CSSProperties} />)}
              </div>
            </div>
            <Link to="/neighborhoods" className="twc-btn twc-btn--outline">Explore the neighborhoods <Icon name="arrow" className="twc-arrow" /></Link>
          </div>
        </section>

        <section className="twc-panel twc-panel--wide twc-c-band-butter border-t border-sb-ink">
          <p className="twc-eyebrow text-sb-ink">There’s a seat for you</p>
          <h2>There is room in this constellation.</h2>
          <p className="copy">The application helps us learn about you, your work, and how you would like to participate in the community.</p>
          <JoinButton />
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
