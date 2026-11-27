import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { calEventsQuery } from "@/features/cal/queries";
import { kindClass } from "@/features/cal/event-state";
import { formatRange } from "@/features/cal/time";
import { rosterQuery } from "@/features/roster/queries";
import { stripMembers } from "@/app/canvas/strip";
import { Experiences } from "@/app/canvas/Experiences";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Arches } from "@/app/canvas/Arches";
import { Bands } from "@/app/canvas/Bands";
// The weekly letter at #letter; the canvas's partner card beside it waits until there is a partner to show.
import { Letter } from "@/app/canvas/Letter";
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

/* ── page ─────────────────────────────────────────────────────────────── */

function HomePage() {
  return (
    <AppPage className="sb-home">
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Intro />
        <Constellations />
        <Members />
        <Experiences />
        <Program />
        <Letter />
        <Arches />
        <Duo />
      </main>
      <AppFooter />
    </AppPage>
  );
}

/** What this is, in one line, before anything else (the canvas's Programme hides its hero; a newcomer needs the words). */
function Intro() {
  return (
    <div className="twc-sec twc-home-intro">
      <h1 className="twc-home-intro__h">Find your people. <i>Build what comes next.</i></h1>
      <p className="twc-home-intro__p">A local-first network of women in business, one neighborhood at a time. Each neighborhood group is a
        constellation: coffees, Zooms and happy hours with women who live near you.</p>
    </div>
  );
}

function Constellations() {
  return (
    <section id="constellations" aria-labelledby="constellations-title">
      <div className="twc-sec twc-sec--tight">
        <div className="twc-home-shead">
          <h2 id="constellations-title" className="twc-h3">Five <i>constellations</i></h2>
          <p className="twc-meta">Live<br />North Brooklyn, Western Queens</p>
          <p className="twc-meta">Launching next<br />Brownstone Brooklyn</p>
        </div>
      </div>
      <Bands />
    </section>
  );
}

/** The canvas's member strip (.twc-members): real roster portraits only, so there is none without a roster. While the
 *  roster loads the strip keeps its space, so the page doesn't jump when it arrives. */
function Members() {
  const { data, isPending } = useQuery(rosterQuery);
  if (isPending) return <div className="twc-members twc-members--pending" aria-hidden />;
  const members = stripMembers(data?.members ?? []);
  if (!members.length) return null;
  return (
    <section className="twc-members" aria-labelledby="members-title">
      <ul className="twc-strip" role="list">
        {members.map((m) => (
          <li key={m.photo} className="twc-strip__item">
            <div className="twc-strip__ph twc-film"><img src={m.photo} alt="" loading="lazy" decoding="async" /></div>
            <p className="twc-strip__n">{m.name}</p>
            <span className="twc-strip__who">{[m.role, m.hood].filter(Boolean).join(" · ")}</span>
          </li>
        ))}
      </ul>
      <div className="twc-members__words">
        <h2 id="members-title" className="twc-members__title">
          <span className="twc-members__stagger">The women behind the</span>
          <span className="twc-members__giant">collective</span>
        </h2>
        <p className="twc-members__aside">A constellation of talent, ambition, and local connections. Meet the women shaping our community.<br />
          <Link to="/directory">Open the directory <span aria-hidden>→</span></Link></p>
      </div>
    </section>
  );
}

function Program() {
  // The public calendar the events page reads, in the browser only: the home page has no loader.
  const { data, isPending } = useQuery(calEventsQuery({ tab: "upcoming", take: 5 }));
  const events = data?.events ?? [];
  // Nothing while it loads; with no dates, one line under the tiles instead of an empty section.
  if (isPending) return null;
  if (!events.length) {
    return (
      <p className="twc-sec twc-home-next">New dates are posted as they’re announced. <Link to="/events" className="twc-inlink">See the calendar</Link></p>
    );
  }
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: events[0].timeZone }).format(new Date(events[0].startTime));
  return (
    <section aria-labelledby="program-title">
      <div className="twc-sec">
        <div className="twc-home-shead">
          <h2 id="program-title" className="twc-h2">Program, <i>{month}</i></h2>
          <p className="twc-meta">Season<br />Winter 2026–27</p>
          <p className="twc-meta">Members<br />Zooms, coffees and happy hours included</p>
        </div>
      </div>
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
        <Link to="/contact" className="twc-btn">Apply to be an ambassador</Link>
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
        <Link to="/partnerships" className="twc-btn twc-btn--outline">Ways to partner <span aria-hidden>→</span></Link>
        <div className="twc-panel__info">
          <p>Event<br />$500–1,500</p>
          <p>Letter<br />$150–500 an issue</p>
          <p>Founding<br />$7,500–10,000 a year</p>
        </div>
      </div>
    </section>
  );
}
