import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { AREAS, areaOfPlace, type Area } from "@/features/applications/schema";
import { calEventsQuery } from "@/features/cal/queries";
import { formatRange } from "@/features/cal/time";
import heroRock from "@/assets/photography/home/hero-rock.webp";
import queensPolaroid from "@/assets/photography/home/queens-polaroid.webp";
import neighbors from "@/assets/photography/home/neighbors.webp";
import natasaFounder from "@/assets/photography/home/natasa-founder.webp";
import gathering from "@/assets/photography/event.jpg";
import { eventSrcSet, heroRockSrcSet } from "@/app/responsive-images";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, JoinButton } from "@/app/layout/twc";
import { jsonLdScript, organizationLd, parseSiteUrl } from "@/app/seo";

export const Route = createFileRoute("/")({
  head: () => {
    // Absolute URLs only: without a valid VITE_SITE_URL there is no structured data at all.
    const site = parseSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined);
    const scripts = site
      ? [jsonLdScript({
          "@context": "https://schema.org",
          "@graph": [organizationLd(site), { "@type": "WebSite", name: "The Women’s Collective", url: `${site}/`, publisher: { "@id": `${site}/#organization` } }],
        })]
      : [];
    return {
      meta: [
        { title: "The Women’s Collective — North Brooklyn and Queens" },
        { name: "description", content: "A community for women building businesses, careers, creative work, and real relationships close to home in North Brooklyn and Queens." },
        { property: "og:title", content: "The Women’s Collective — North Brooklyn and Queens" },
        { property: "og:description", content: "Find your people, share what you do, and help someone else shine." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts,
    };
  },
  component: HomePage,
});

/* ── data ─────────────────────────────────────────────────────────────── */

// The two live areas as constellation bands, in AREAS order. Copy is the page's own; nothing here is a member fact.
const BANDS: Record<string, { field: string; body: string }> = {
  "north-brooklyn": { field: "twc-c-band-lime", body: "Greenpoint, Williamsburg, East Williamsburg and Bushwick sit across Newtown Creek from Long Island City." },
  queens: { field: "twc-c-band-purple", body: "Each neighborhood has its own identity and color. The central star is the point where those neighborhoods and connections meet." },
};

const TILE_SIZES = "(min-width: 1101px) 17vw, (min-width: 601px) 34vw, 50vw";
// 6-up: colour tiles (what you do here) on the even slots, photos between; 3-up on tablets, 2-up on phones.
const TILES = [
  { field: "twc-c-band-butter", title: "Share what you do", text: "Introduce your business, work, or project and help neighbors understand what you bring." },
  { src: queensPolaroid, alt: "Women laughing together at an evening rooftop event", caption: "Our people, Queens" },
  { field: "twc-c-blush", title: "Find collaborators", text: "Build partnerships, exchange referrals, and discover opportunities through people nearby." },
  { src: gathering, srcSet: eventSrcSet, alt: "Women talking together at a collective event", caption: "The collective, in person" },
  { field: "twc-c-tomato", title: "Show up locally", text: "Promote women-owned businesses and learn about events and meetups close to home." },
  { src: heroRock, srcSet: heroRockSrcSet, alt: "A woman in sunglasses sitting on a sunlit rock beneath a wide blue sky", caption: "Close to home" },
] as const;

// Three on the homepage; the rest live on /faq.
const FAQ = [
  { q: "Who is the collective for?", a: "Women in North Brooklyn and Queens who are building something — a business, a career, a creative practice — and want real relationships close to home. Founders, freelancers, makers, and the newly curious are all welcome. No follower count or pitch deck required." },
  { q: "Is the community inclusive?", a: "Yes. We welcome women from all backgrounds, including moms, married and single women, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, international members, and people from diverse cultures." },
  { q: "What happens after I apply?", a: "A real person reads every application. We’ll be in touch by email about next steps." },
];

const EV_FIELDS = ["bg-sb-ev-mint", "bg-sb-ev-peri", "bg-sb-lilac"];
const no = (i: number) => String(i + 1).padStart(2, "0");

/* ── page ─────────────────────────────────────────────────────────────── */

function HomePage() {
  return (
    <AppPage className="sb-home">
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Opening />
        <Constellations />
        <WhoYoullMeet />
        <WhatsOn />
        <Cards />
        <Faq />
        <Panels />
      </main>
      <AppFooter />
    </AppPage>
  );
}

function Opening() {
  return (
    <section aria-labelledby="home-title" className="twc-home-open">
      <div className="flex flex-col gap-5">
        <span className="twc-eyebrow">North Brooklyn &amp; Queens</span>
        <h1 id="home-title" className="twc-display">Find your people.</h1>
        <p className="twc-lede">For women building businesses, careers, creative work, and real relationships close to home.</p>
        <JoinButton className="self-start" />
      </div>
      <p className="twc-meta">Live<br />{AREAS.map((a) => a.name).join(" · ")}</p>
    </section>
  );
}

function Constellations() {
  const hoods = useNeighborhoods().data.filter((n) => n.active);
  return (
    <section id="constellations" aria-labelledby="constellations-title">
      <div className="twc-sec twc-sec--tight">
        <div className="twc-shead mb-0!">
          <h2 id="constellations-title" className="twc-h3">Two constellations</h2>
          <Link to="/neighborhoods" className="twc-inlink">Explore the neighborhoods</Link>
        </div>
      </div>
      <div className="twc-cbands">
        {AREAS.map((area, i) => (
          // ponytail: a neighborhood on neither area's list shows on /neighborhoods only, not in a band.
          <Band key={area.id} area={area} index={i} hoods={hoods.filter((n) => areaOfPlace(n.name)?.id === area.id)} open={i === 0} />
        ))}
      </div>
    </section>
  );
}

function Band({ area, index, hoods, open }: { area: Area; index: number; hoods: { slug: string; name: string; color: string }[]; open: boolean }) {
  const band = BANDS[area.id];
  return (
    <details className={`twc-cband ${band.field}`} open={open}>
      <summary>
        <span className="twc-cband__no">Nº{index + 1}<b>{area.borough}</b></span>
        <span className="twc-cband__name">{area.name}</span>
        <span className="twc-cband__st">Live</span>
      </summary>
      <div className="twc-cband__more">
        <div>
          <p className="body">{band.body}</p>
          <ul aria-label={`${area.name} neighborhoods`} className="twc-home-hoods">
            {hoods.map((n) => (
              <li key={n.slug}>
                <span aria-hidden className="twc-dot bg-(--hood)" style={{ "--hood": n.color } as CSSProperties} />
                {n.name}
              </li>
            ))}
          </ul>
          <JoinButton />
        </div>
        {area.id === "north-brooklyn" ? <NorthBrooklynMap /> : <p aria-hidden className="twc-cband__outline">{hoods.map((n) => n.name).join(" · ")}</p>}
      </div>
    </details>
  );
}

function NorthBrooklynMap() {
  return (
    <figure className="twc-map twc-home-map">
      <svg viewBox="0 0 640 460" role="img" aria-label="Map: Greenpoint, Williamsburg, East Williamsburg and Bushwick across Newtown Creek from Long Island City, with Nataša’s studio marked in Greenpoint">
        <rect width="640" height="460" className="fill-sb-paper" />
        <path d="M0 0 L168 0 C178 40 196 80 190 118 C184 160 168 200 178 246 C188 300 218 360 250 460 L0 460 Z" className="fill-sb-map-water" />
        <path d="M184 112 C230 122 280 132 330 128 C380 124 412 108 444 128 C478 150 500 182 540 196 C572 208 610 206 640 214" fill="none" strokeWidth="16" strokeLinecap="round" className="stroke-sb-map-water" />
        <path d="M196 138 C240 146 290 152 330 148 C372 144 410 130 440 148 C470 166 494 196 534 214 C570 230 596 262 606 300 C616 344 604 392 588 430 L420 444 C360 446 300 438 262 420 C238 380 214 330 200 280 C190 236 192 190 196 138 Z" strokeWidth="2.5" strokeLinejoin="round" className="fill-sb-band-lime stroke-sb-ink" />
        <g fill="none" strokeWidth="1.5" strokeDasharray="6 6" opacity=".6" className="stroke-sb-ink">
          <path d="M196 226 C260 232 330 228 410 214 C440 208 470 200 500 196" />
          <path d="M330 228 C344 290 352 360 360 442" />
          <path d="M352 332 C420 330 500 320 600 316" />
        </g>
        <g className="fill-sb-ink font-plex" fontSize="18">
          <text x="250" y="196">Greenpoint</text>
          <text x="216" y="300">Williamsburg</text>
          <text x="376" y="276">East Williamsburg</text>
          <text x="430" y="392">Bushwick</text>
          <text x="250" y="66">Long Island City</text>
          <text x="24" y="210">East River</text>
        </g>
        <circle cx="238" cy="58" r="6" className="fill-sb-ink" />
        <text x="296" y="176" fontSize="26" className="fill-sb-ink">✶</text>
      </svg>
      <figcaption>✶ Nataša’s studio, Greenpoint</figcaption>
    </figure>
  );
}

function WhoYoullMeet() {
  return (
    <section aria-labelledby="meet-title">
      <h2 id="meet-title" className="twc-inline">
        <span className="sr-only">Who you’ll meet here: </span>
        Founders <span aria-hidden>✺</span> makers <span aria-hidden className="twc-chipmark twc-home-chip" /> creatives, artists <em>and</em> organizers <span aria-hidden>✺</span> longtime locals <em>&amp; brand-new</em> arrivals
      </h2>
      <div className="twc-grid6">
        {TILES.map((t, i) =>
          "src" in t ? (
            <figure key={t.caption} className="twc-tile twc-tile--photo twc-c-stone m-0">
              <img src={t.src} srcSet={"srcSet" in t ? t.srcSet : undefined} sizes={TILE_SIZES} alt={t.alt} loading="lazy" decoding="async" />
              <span>{t.caption}</span>
            </figure>
          ) : (
            <article key={t.title} className={`twc-tile ${t.field}`}>
              <div><span className="no">{no(i / 2)}</span><h3>{t.title}</h3></div>
              <p className="p">{t.text}</p>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

function WhatsOn() {
  // The public calendar the events page reads, in the browser only: the home page has no loader.
  const { data } = useQuery(calEventsQuery({ tab: "upcoming", take: 3 }));
  const events = data?.events ?? [];
  return (
    <section aria-labelledby="whats-on-title">
      <div className="twc-sec">
        <div className="twc-shead mb-0!">
          <h2 id="whats-on-title" className="twc-h2">What’s on</h2>
          <Link to="/events" className="twc-inlink">See every event</Link>
        </div>
      </div>
      {events.length > 0 && (
        <div className="twc-evs">
          {events.map((e, i) => (
            <article key={e.uid} className={`twc-ev ${EV_FIELDS[i % EV_FIELDS.length]}`}>
              <h3>{e.title}{e.category && <b>{e.category}</b>}</h3>
              <p className="twc-meta">{formatRange(e.startTime, e.endTime, e.timeZone)}</p>
              <p className="twc-meta">{e.location}</p>
              <p className="twc-meta"><Link to="/events/$slug" params={{ slug: e.slug }}>Details and RSVP<span className="sr-only">: {e.title}</span> ↗</Link></p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Cards() {
  return (
    <section aria-label="About the collective" className="twc-cards">
      <article id="mission" className="twc-card twc-home-card">
        <p className="twc-eyebrow">Why we exist</p>
        <h2 className="twc-card__title">Our mission</h2>
        <p className="twc-home-big">The Women’s Collective brings women across North Brooklyn and Queens together to meet, share knowledge, support one another’s work, and build real relationships close to home.</p>
        <p>When women know who is around them, they can recommend each other, collaborate, show up for each other’s events, and create opportunities that would be harder to build alone.</p>
        <JoinButton className="self-start" />
      </article>
      <article className="twc-card twc-home-card">
        <p className="twc-eyebrow">How it works</p>
        <h2 className="twc-card__title">Connections that move work forward</h2>
        <p className="twc-home-big">Not networking for networking’s sake. This is a place to build genuine relationships and support women-owned work.</p>
        <img src={neighbors} alt="Hands shaping a handmade ceramic cup in a sunny studio" loading="lazy" decoding="async" className="twc-home-cardphoto" />
      </article>
      <article className="twc-card twc-card--dark twc-home-card">
        <p className="twc-eyebrow text-sb-paper!">Our founder</p>
        <h2 className="twc-card__title">Meet Nataša</h2>
        <img src={natasaFounder} alt="Portrait of Nataša Tuohy, founder of The Women’s Collective" loading="lazy" decoding="async" className="twc-home-cardphoto" />
        <p>Nataša Tuohy is a New York–based architectural and interior designer whose work brings European sensibility together with New York pragmatism. Educated at the University of Florence, she founded her Greenpoint studio around thoughtful spaces, trusted collaboration, and enduring relationships.</p>
        <a href="https://natasatuohy.com/about/" target="_blank" rel="noreferrer" className="twc-btn twc-btn--paper self-start">
          Visit Nataša’s studio <Icon name="arrowUp" className="size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </article>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="twc-sec twc-home-faq">
      <div className="flex flex-col gap-4">
        <h2 id="faq-title" className="twc-h2">Questions, answered.</h2>
        <p className="twc-lede">Still wondering about something? Send us a note — a real person reads every one.</p>
        <Link to="/contact" className="twc-inlink self-start">Ask us anything</Link>
      </div>
      <div>
        {FAQ.map((item, i) => (
          <details key={item.q} name="faq" open={i === 0} className="twc-faq">
            <summary>
              <span className="twc-index">{no(i)}</span>
              <span className="twc-faq__q">{item.q}</span>
              <span className="twc-faq__toggle"><Icon name="plus" /></span>
            </summary>
            <p className="twc-faq__a">{item.a}</p>
          </details>
        ))}
        <Link to="/faq" className="twc-inlink mt-6 inline-block">More questions</Link>
      </div>
    </section>
  );
}

function Panels() {
  return (
    <section aria-label="Take part" className="twc-duo">
      <div className="twc-panel twc-c-sky">
        <span className="twc-eyebrow text-sb-ink!">Membership</span>
        <h2>There is room in this constellation.</h2>
        <p className="copy">The application helps us learn about you, your work, and how you would like to participate in the community.</p>
        <JoinButton />
        <div className="twc-panel__info">
          <p>Areas<br />North Brooklyn · Queens</p>
          <p>Who reads it<br />A real person, every time</p>
          <p>Next<br />We’ll be in touch by email</p>
        </div>
      </div>
      <div className="twc-panel twc-c-blush">
        <span className="twc-eyebrow text-sb-ink!">Partners</span>
        <h2>Partners, not vendors.</h2>
        <p className="copy">Every event happens because someone opens their doors and shares what they know. That’s a collaboration, and we treat it like one.</p>
        <Link to="/partnerships" className="twc-btn twc-btn--outline">Ways to partner <Icon name="arrow" className="twc-arrow size-3.5" /></Link>
        <div className="twc-panel__info">
          <p>Host<br />Open your space</p>
          <p>Teach<br />Share what you know</p>
          <p>Supply<br />Feed the room</p>
        </div>
      </div>
    </section>
  );
}
