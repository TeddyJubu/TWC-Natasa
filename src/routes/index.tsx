import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { calEventsQuery } from "@/features/cal/queries";
import { kindClass } from "@/features/cal/event-state";
import { formatRange } from "@/features/cal/time";
import xpZoom from "@/assets/photography/home/xp-zoom.webp";
import xpCoffee from "@/assets/photography/home/xp-coffee.webp";
import xpPanel from "@/assets/photography/home/xp-panel.webp";
import xpWorkshop from "@/assets/photography/home/xp-workshop.webp";
import xpEvening from "@/assets/photography/home/xp-evening.webp";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, JoinButton } from "@/app/layout/twc";
import { StarChart } from "@/app/StarChart";
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

/* ── data: the design canvas's homepage ("01 Programme", docs/design-canvas/), its own copy ─────────────────────────── */

// The five constellations. No member appears: the star chart draws no member or count, and the canvas's profile
// strips are members-only data.
const CONSTELLATIONS = [
  { short: "NB", name: "North Brooklyn", status: "Live · Founding 50", live: true, field: "twc-c-band-lime", hoods: "Greenpoint — Williamsburg — Bushwick",
    led: "Nataša Tuohy", head: "The women behind the Collective", body: "A constellation of talent, ambition, and local connections. Meet the women shaping our community." },
  { short: "WQ", name: "Western Queens", status: "Live", live: true, field: "twc-c-band-purple", hoods: "Astoria — Long Island City — Hunters Point — Sunnyside — Woodside — Jackson Heights",
    led: "Ambassador-led", body: "Sunday coffees in Astoria, headshot days and a growing table of makers, agents and teachers." },
  { short: "SB", name: "Brownstone Brooklyn", status: "Launching", live: false, field: "twc-c-sky", hoods: "Red Hook — Carroll Gardens — Cobble Hill — Boerum Hill — Park Slope",
    led: "Ambassador onboarding", body: "Our next constellation. The launch coffee is on the calendar for December." },
  { short: "UP", name: "Uptown Manhattan", status: "Ambassador wanted", live: false, field: "twc-c-band-butter", hoods: "Lincoln Square — Upper West Side — Central Park West / West 80s–90s — Carnegie Hill — Upper East Side",
    led: "Looking for 2 ambassadors", body: "Every neighborhood is led by two or three women who live there. This one is waiting for its leads." },
  { short: "DT", name: "Downtown Manhattan", status: "Ambassador wanted", live: false, field: "twc-c-band-red", hoods: "West Village — Greenwich Village — SoHo — Hudson Square — Tribeca",
    led: "Looking for 2 ambassadors", body: "Every neighborhood is led by two or three women who live there. This one is waiting for its leads." },
] as const;

// The seven ways to take part, as colour tiles; photos sit between them (12 cells: 6 / 3 / 2 across).
const XP = [
  { k: "Constellation Zooms", h: "A monthly call with your own Constellation to share updates, ask for introductions, and follow up on what you’re working on.", a: ["Included in membership", "Your Constellation"], field: "bg-sb-ev-green" },
  { k: "Coffee Connections", h: "A small neighborhood coffee where there’s time for a real conversation. New dates posted as they’re announced.", a: ["Included in membership", "First visit complimentary for invited guests", "Drinks purchased separately"], field: "bg-sb-ev-mint" },
  { k: "Constellation Meetups", h: "A larger, in-person meetup for each Constellation, with time for introductions and member spotlights.", a: ["Included in membership", "Your Constellation"], field: "bg-sb-ev-peri" },
  { k: "Expert Panels", h: "A focused conversation with two or three women who have firsthand experience with the topic, followed by audience Q&A.", a: ["Ticketed", "Member pricing", "Open to guests"], field: "bg-sb-ev-violet" },
  { k: "Hands-on Workshops", h: "A guided working session where you leave with something you can use, such as a revised pitch or a plan for your next launch.", a: ["Ticketed", "Member pricing", "Guest access by event"], field: "bg-sb-ev-sea" },
  { k: "Incubator Growth Sessions", h: "A small group that meets over several sessions to work through a specific business goal and follow up on progress.", a: ["Members only", "Separate paid program"], field: "bg-sb-cobalt twc-home-tile--dark" },
  { k: "Happy Hours", h: "An informal evening to meet members in your neighborhood. New dates posted as they’re announced.", a: ["Included in membership", "First visit complimentary for invited guests", "Drinks purchased separately"], field: "bg-sb-sky" },
] as const;
// Stock photos (src/assets/photography/home/CREDITS.md), captioned by kind only: they are not our events.
const PHOTOS = {
  zoom: { src: xpZoom, alt: "A woman waving on a video call on a laptop", caption: "Zoom night" },
  coffee: { src: xpCoffee, alt: "Two women talking over coffee at a café table", caption: "Coffee" },
  panel: { src: xpPanel, alt: "A woman speaking into a microphone on a panel", caption: "Expert panel" },
  workshop: { src: xpWorkshop, alt: "Two women drawing at a workshop table", caption: "Workshop" },
  evening: { src: xpEvening, alt: "A hand lighting a candle on a long table", caption: "Happy hour" },
} as const;
type Cell = { tile: number } | { photo: keyof typeof PHOTOS };
const GRID: Cell[] = [
  { tile: 0 }, { photo: "zoom" }, { tile: 1 }, { photo: "coffee" }, { tile: 2 }, { tile: 3 },
  { photo: "panel" }, { tile: 4 }, { photo: "workshop" }, { tile: 5 }, { tile: 6 }, { photo: "evening" },
];
const no = (i: number) => String(i + 1).padStart(2, "0");

/* ── page ─────────────────────────────────────────────────────────────── */

function HomePage() {
  return (
    <AppPage className="sb-home">
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* The canvas's Programme variation hides its hero; its headline stays for screen readers and route focus. */}
        <h1 className="sr-only">Find your people. Build what comes next.</h1>
        <Constellations />
        <Experiences />
        <Program />
        <Cards />
        <Duo />
      </main>
      <AppFooter />
    </AppPage>
  );
}

function Constellations() {
  return (
    <section id="constellations" aria-labelledby="constellations-title">
      <div className="twc-sec twc-sec--tight">
        <div className="twc-home-shead">
          <h2 id="constellations-title" className="twc-h3">Five <i>constellations</i></h2>
          <p className="twc-meta">Live<br />North Brooklyn, Western Queens</p>
          <p className="twc-meta">Next<br />Brownstone Brooklyn</p>
        </div>
      </div>
      <div className="twc-cbands">
        {CONSTELLATIONS.map((c, i) => (
          <details key={c.short} className={`twc-cband ${c.field}`}>
            <summary>
              <span className="twc-cband__no">Nº{i + 1}<b>{c.short}</b></span>
              <span className="twc-cband__name">{c.name}</span>
              <span className="twc-cband__st">{c.status}</span>
            </summary>
            <div className="twc-cband__more">
              <div>
                {"head" in c && <p className="twc-home-bandhead">{c.head}</p>}
                <p className="body">{c.body}</p>
                {c.live ? <JoinButton /> : (
                  <Link to="/contact" className="twc-btn">Lead this constellation <Icon name="arrow" className="twc-arrow size-3.5" /></Link>
                )}
                <p className="twc-meta mt-8">Led by<br />{c.led}</p>
              </div>
              <div>
                <StarChart id={c.short} name={c.name} hoods={c.hoods} />
                <p className="twc-cband__outline" aria-hidden="true">{c.hoods}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Experiences() {
  return (
    <section aria-labelledby="xp-title">
      <h2 id="xp-title" className="twc-inline">
        Zooms <span aria-hidden>✺</span> Coffee <span aria-hidden className="twc-chipmark twc-home-chip" /> Meetups, panels <em>and</em> happy hours <span aria-hidden>✺</span> workshops <em>that move you</em> forward
      </h2>
      <div className="twc-grid6">
        {GRID.map((cell) => {
          if ("photo" in cell) {
            const p = PHOTOS[cell.photo];
            return (
              <figure key={cell.photo} className="twc-tile twc-tile--photo twc-c-stone m-0">
                <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
                <figcaption>{p.caption}</figcaption>
              </figure>
            );
          }
          const x = XP[cell.tile];
          return (
            <Link key={x.k} to="/events" className={`twc-tile ${x.field}`}>
              <div><span className="no">{no(cell.tile)}</span><h3>{x.k}</h3><p className="h">{x.h}</p></div>
              <p className="p">{x.a.map((line, i) => <span key={line} className="block">{i > 0 && <span className="sr-only"> · </span>}{line}</span>)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Program() {
  // The public calendar the events page reads, in the browser only: the home page has no loader.
  const { data } = useQuery(calEventsQuery({ tab: "upcoming", take: 5 }));
  const events = data?.events ?? [];
  const month = events[0] && new Intl.DateTimeFormat("en-US", { month: "long", timeZone: events[0].timeZone }).format(new Date(events[0].startTime));
  return (
    <section aria-labelledby="program-title">
      <div className="twc-sec">
        <div className="twc-home-shead">
          <h2 id="program-title" className="twc-h2">Program{month && <>, <i>{month}</i></>}</h2>
          <p className="twc-meta">Season<br />Winter 2026–27</p>
          <p className="twc-meta">Members<br />Zooms, coffees and happy hours included</p>
        </div>
        {events.length === 0 && (
          <p className="twc-lede mt-6">New dates are posted as they’re announced. <Link to="/events" className="twc-inlink">See the calendar</Link></p>
        )}
      </div>
      {events.length > 0 && (
        <div className="twc-evs">
          {events.map((e) => (
            <article key={e.uid} className={`twc-ev ${kindClass(e.category)}`}>
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
    <section aria-label="The letter and partners" className="twc-cards">
      <article id="letter" className="twc-card twc-home-card">
        <p className="twc-eyebrow">Every Thursday</p>
        <h2 className="twc-card__title">The Collective letter</h2>
        <div className="twc-home-two">
          <p className="twc-home-big">Member stories, local finds and opportunities.</p>
          <p className="text-[12.5px] leading-snug">One email a week. Unsubscribe in a click. Guests welcome.</p>
        </div>
        <p>Opt in to the letter on your application.</p>
        <JoinButton className="self-start" />
      </article>
      <article className="twc-card twc-card--dark twc-home-card twc-home-card--strip">
        <p className="twc-eyebrow text-sb-paper!">Spotlight partner</p>
        <h2 className="twc-card__title">Your brand here</h2>
        <p className="max-w-[30ch]">One partner per season on the homepage, in the letter and at every event.</p>
        <Link to="/partnerships" className="twc-btn twc-btn--paper self-start">See packages <Icon name="arrow" className="twc-arrow size-3.5" /></Link>
        <p aria-hidden className="twc-home-strip">Partner</p>
      </article>
    </section>
  );
}

function Duo() {
  return (
    <section aria-label="Lead or partner" className="twc-duo">
      <div className="twc-panel twc-c-sky">
        <span className="twc-eyebrow text-sb-ink!">Ambassadors</span>
        <h2>Lead a <i>constellation</i></h2>
        <p className="copy">Every neighborhood is led by two or three women who live there. Uptown and Downtown Manhattan are waiting for theirs.</p>
        <Link to="/contact" className="twc-btn">Become an ambassador <Icon name="arrow" className="twc-arrow size-3.5" /></Link>
        <div className="twc-panel__info">
          <p>Uptown<br />Two seats open</p>
          <p>Downtown<br />Two seats open</p>
          <p>Term<br />One year</p>
        </div>
      </div>
      <div className="twc-panel twc-c-blush">
        <span className="twc-eyebrow text-sb-ink!">Partners</span>
        <h2>Partner <i>with</i> us</h2>
        <p className="copy">Bring a space, a product or a budget, and meet the women who run businesses and households in our neighborhoods.</p>
        <Link to="/partnerships" className="twc-btn twc-btn--outline">Ways to partner <Icon name="arrow" className="twc-arrow size-3.5" /></Link>
      </div>
    </section>
  );
}
