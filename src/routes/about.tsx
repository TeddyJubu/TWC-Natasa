import { Link, createFileRoute } from "@tanstack/react-router";
import aboutGathering from "@/assets/photography/site/about-gathering.webp";
import { aboutGatheringSizes, aboutGatheringSrcSet } from "@/app/responsive-images";
import aboutCoffee from "@/assets/photography/site/about-coffee.webp";
import natasaFounder from "@/assets/photography/home/natasa-founder.webp";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, Scallop, TwcRibbon } from "@/app/layout/twc";
import { useNeighborhoods } from "@/features/neighborhoods/queries";

const TITLE = "About — The Women’s Collective";
const DESCRIPTION = "The Women’s Collective brings women across Queens together to meet, share knowledge, support one another’s work, and build real relationships close to home.";

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
  { tone: "twc-stamp--olive", title: "Introduce yourself", text: "Tell us about your work, the people you hope to meet, and how you want to contribute." },
  { tone: "twc-stamp--mustard", title: "A real person reads it", text: "Someone in Queens reads every application. We’ll be in touch by email about next steps." },
  // Board note doubted "everything unlocks at once": list only what approval itself grants, no timing.
  { tone: "", title: "Get welcomed in", text: "Approval brings your catalogue number, the chance to save a seat at member gatherings, and the choice to show your card in the directory." },
  { tone: "twc-stamp--terracotta", title: "Show up", text: "Save your seat, meet the neighbors we introduce you to, and help someone else shine." },
];

const VALUES = [
  { title: "Generous", text: "Not networking for networking’s sake. We give referrals, make introductions and share what we know." },
  { title: "Local", text: "Rooted in Western Queens, from Long Island City to Rego Park. Each neighborhood has its own identity and color." },
  { title: "Inclusive", text: "Women from all backgrounds, including moms, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, and international members." },
];

function AboutPage() {
  const { data: neighborhoods } = useNeighborhoods();
  const hoods = neighborhoods.filter((n) => n.active);
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-wrap flex flex-wrap items-center gap-14 pb-[88px] pt-[72px]">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            <p className="twc-eyebrow-script">about the collective</p>
            <h1 className="twc-display">A collective built close to home.</h1>
            <p className="twc-lede max-w-[560px]">{DESCRIPTION}</p>
            <p className="twc-chip twc-chip--ring self-start"><Icon name="pin" />Western Queens, New York</p>
          </div>
          <div className="relative min-h-[440px] min-w-0 flex-[1_1_380px]">
            <img src={aboutGathering} srcSet={aboutGatheringSrcSet} sizes={aboutGatheringSizes} alt="A group of women laughing together outdoors on a sunny day" width={1280} height={1600} fetchPriority="high" className="twc-photo twc-photo--arch absolute left-0 top-0 aspect-[5/7] w-[min(300px,80%)]" />
            <figure className="twc-polaroid absolute -bottom-2.5 right-0 w-[min(200px,55%)]">
              <img src={aboutCoffee} alt="Two women chatting over coffee at an outdoor café" width={1600} height={901} loading="lazy" />
              <figcaption>our people, Queens</figcaption>
            </figure>
          </div>
        </section>

        <div className="pb-9 pt-3">
          <TwcRibbon items={hoods.map((n) => n.name)} label="Pause the neighborhood ribbon" />
        </div>

        <Scallop from="#fcfcfa" to="#f3f0e8" />
        <section className="twc-band twc-band--cream">
          <div className="twc-wrap flex max-w-[820px] flex-col items-center gap-[18px] text-center">
            <p className="twc-eyebrow">Why it matters</p>
            <h2 className="twc-h3">Opportunity starts with knowing who’s nearby.</h2>
            <p className="max-w-[620px] text-[17px] leading-[1.6] text-sb-muted">When women know who is around them, they can recommend each other, collaborate, show up for each other’s events, and create opportunities that would be harder to build alone.</p>
          </div>
        </section>
        <Scallop from="#f3f0e8" to="#fcfcfa" />

        <section className="twc-wrap flex flex-col gap-9 pb-[104px] pt-[88px]">
          <div className="flex flex-col gap-2">
            <p className="twc-eyebrow-script">how it works</p>
            <h2 className="twc-h2">From hello to neighbor in four steps.</h2>
          </div>
          <ol className="twc-stamp-grid m-0 list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))]">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`twc-stamp ${s.tone}`}>
                <span className="twc-index">0{i + 1}</span>
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-[32px]">{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Scallop from="#fcfcfa" to="#edd22e" />
        <section className="twc-band twc-band--sun">
          <div className="twc-wrap flex flex-col gap-11">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="twc-eyebrow-script text-sb-ink">come as you are</p>
              <h2 className="twc-h3">What we value</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-10">
              {VALUES.map((v) => (
                <div key={v.title} className="flex flex-col gap-3 border-t border-sb-ink/25 pt-5">
                  <h3 className="font-editorial text-[44px] italic leading-[1.06] tracking-[-0.5px]">{v.title}</h3>
                  <p>{v.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <Scallop from="#edd22e" to="#0b0b0a" />

        <section aria-labelledby="founder-title" className="twc-band twc-band--night">
          <div className="twc-wrap flex flex-wrap items-center gap-[72px] max-md:gap-12">
            <div className="flex min-w-0 flex-[0_1_340px] justify-center">
              <figure className="twc-polaroid twc-polaroid--night twc-polaroid--left w-[min(300px,100%)]">
                <img src={natasaFounder} alt="Portrait of Nataša Tuohy, founder of The Women’s Collective" width={800} height={800} loading="lazy" className="aspect-[4/5]" />
                <figcaption className="inline-flex items-center gap-2">Nataša, founder <Icon name="sparkle" /></figcaption>
              </figure>
            </div>
            <div className="flex min-w-0 flex-[1_1_420px] flex-col items-start gap-[18px]">
              <p className="twc-eyebrow text-sb-paper/60">Founder</p>
              <h2 id="founder-title" className="twc-display md:text-[74px]">
                Meet Nataša <span className="font-script text-[0.7em] leading-none tracking-normal text-sb-sun">(hi!)</span>
              </h2>
              <p className="max-w-[560px] text-[17px] leading-[1.65] text-sb-paper/75">Nataša is a New York–based architectural and interior designer whose work brings European sensibility together with New York pragmatism. Educated at the University of Florence, she founded her Greenpoint studio around thoughtful spaces, trusted collaboration, and enduring relationships.</p>
              <a className="twc-btn twc-btn--sun mt-1.5" href="https://natasatuohy.com/about/" target="_blank" rel="noreferrer">
                Visit Nataša’s studio <Icon name="arrowUp" className="twc-arrow" /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>
        </section>
        <Scallop from="#0b0b0a" to="#fcfcfa" />

        <section className="twc-wrap flex flex-wrap items-end justify-between gap-8 pb-12 pt-[88px]">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
            <p className="twc-eyebrow-script">our constellation</p>
            <h2 className="twc-h3">Every connection makes the whole community stronger</h2>
            <p className="max-w-[560px] text-sb-muted">The central star is the point where our neighborhoods and connections meet.</p>
            <div role="img" aria-label={`Neighborhood colors: ${hoods.map((n) => n.name).join(", ")}`} className="mt-1.5 flex flex-wrap gap-3.5">
              {hoods.map((n) => <span key={n.slug} title={n.name} className="twc-dot size-3.5" style={{ background: n.color }} />)}
            </div>
          </div>
          <Link to="/neighborhoods" className="twc-btn twc-btn--outline">Explore the neighborhoods <Icon name="arrow" className="twc-arrow" /></Link>
        </section>

        <section className="twc-wrap pb-[104px] pt-12">
          <div className="twc-ticket bg-[linear-gradient(160deg,#16213f_0%,#0b0b0a_100%)]">
            <div className="twc-ticket__main">
              <p className="twc-eyebrow-script">psst — there’s a seat for you</p>
              <h2 className="twc-display">There is room in this constellation.</h2>
              <span aria-hidden className="font-script text-[30px] leading-[1.3] text-sb-sun">← that’s you</span>
            </div>
            <div className="twc-ticket__stub">
              <div className="twc-ticket__meta"><span>Admit one</span><span>Nº 0001 — Queens</span></div>
              <p className="text-base leading-[1.6] text-sb-paper/85">The application helps us learn about you, your work, and how you would like to participate in the community.</p>
              <Link to="/join" className="twc-btn twc-btn--paper">Start your application <Icon name="arrow" className="twc-arrow" /></Link>
            </div>
          </div>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
