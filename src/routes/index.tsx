import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import { ConstellationLogo, cn, type MemberProfile } from "@/index";
import { loadPublicProfiles, publicProfilesQuery } from "@/features/members/queries";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import heroRock from "@/assets/photography/home/hero-rock.webp";
import queensPolaroid from "@/assets/photography/home/queens-polaroid.webp";
import deskFlatlay from "@/assets/photography/home/desk-flatlay.webp";
import balconyFriends from "@/assets/photography/home/balcony-friends.webp";
import neighbors from "@/assets/photography/home/neighbors.webp";
import natasaFounder from "@/assets/photography/home/natasa-founder.webp";
import nightSky from "@/assets/photography/home/night-sky.webp";
import gathering from "@/assets/photography/event.jpg";
import { eventPolaroidSizes, eventSizes, eventSrcSet, heroRockSizes, heroRockSrcSet } from "@/app/responsive-images";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, Scallop } from "@/app/layout/twc";
import caveatUrl from "@/assets/fonts/home/caveat-400.woff2?url";
import { jsonLdScript, organizationLd, parseSiteUrl } from "@/app/seo";

export const Route = createFileRoute("/")({
  // The portrait row's public cards, so the server renders it.
  loader: ({ context }) => loadPublicProfiles(context.queryClient),
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
        { title: "The Women’s Collective — Find your people in Queens" },
        { name: "description", content: "A community for women building businesses, careers, creative work, and real relationships close to home in Western Queens." },
        { property: "og:title", content: "The Women’s Collective — Find your people in Queens" },
        { property: "og:description", content: "Find your people, share what you do, and help someone else shine." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "preload", href: caveatUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" }],
      scripts,
    };
  },
  component: HomePage,
});

/* ── data ─────────────────────────────────────────────────────────────── */

const NEIGHBORHOODS = ["Long Island City", "Astoria", "Sunnyside", "Woodside", "Jackson Heights", "Elmhurst", "Forest Hills", "Rego Park"];
const ROLES = [
  ["founders", "makers", "creatives"],
  ["career-builders", "neighbors", "artists"],
  ["shop owners", "organizers", "daydreamers"],
];
// White, not paper, on olive and terracotta: paper is 4.4:1 there, under AA for body text.
const BRICKS = [
  { title: "Share what you do", text: "Introduce your business, work, or project and help neighbors understand what you bring.", tone: "bg-sb-mustard text-sb-ink" },
  { title: "Find collaborators", text: "Build partnerships, exchange referrals, and discover opportunities through people nearby.", tone: "bg-sb-rose text-sb-ink" },
  { title: "Show up locally", text: "Promote women-owned businesses and learn about gatherings, events, and meetups across Queens.", tone: "bg-sb-terracotta text-white" },
];

// Three on the homepage; the rest live on /faq. "Which neighborhoods" is left out: the ribbon and the colour row answer it.
const FAQ = [
  { q: "Who is the collective for?", a: "Women in Queens who are building something — a business, a career, a creative practice — and want real relationships close to home. Founders, freelancers, makers, and the newly curious are all welcome. No follower count or pitch deck required." },
  { q: "Is the community inclusive?", a: "Yes. We welcome women from all backgrounds, including moms, married and single women, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, international members, and people from diverse cultures." },
  { q: "What happens after I apply?", a: "A real person in Queens reads every application. We’ll be in touch by email about next steps." },
];

// The hero's entrance: when each piece starts, in ms after first paint.
const HERO_BEATS = { headline: 250, lede: 700, cta: 850, chip: 900, polaroid: 1100, note: 1500 };

/* ── shared look: one container, one rhythm, one shadow ───────────────── */

const wrap = "mx-auto w-full max-w-[1440px] px-4 lg:px-16";
const band = "py-[72px] lg:py-28";
const h2 = "font-display text-[clamp(2.25rem,3.75vw,3.375rem)] leading-[1.09] text-balance";
const script = "font-script text-[32px] leading-[1.1] lg:text-[44px]";
const lift = "shadow-[0_1px_2px_rgb(31_31_28/0.1),0_16px_34px_-12px_rgb(31_31_28/0.3)]";
const liftNight = "shadow-[0_14px_30px_rgb(0_0_0/0.4)]";
const tape = "absolute h-7 w-[110px] bg-sb-cream/85 shadow-[0_1px_2px_rgb(31_31_28/0.12)]";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const pill = "sb-pill inline-flex items-center gap-2 whitespace-nowrap rounded-full font-display uppercase tracking-[1.6px] outline-none focus-visible:ring-2 focus-visible:ring-sb-blue focus-visible:ring-offset-2";
const inkPill = cn(pill, "bg-sb-ink px-6 py-3.5 text-[13px] text-sb-paper hover:bg-black lg:text-sm");
const moreLink = "group inline-flex w-fit items-center gap-2.5 font-display text-sm uppercase tracking-[1.6px] text-sb-blue-ink outline-none focus-visible:underline";

/* ── small pieces ─────────────────────────────────────────────────────── */

function Ribbon({ items, className, reverse }: { items: string[]; className: string; reverse?: boolean }) {
  // Two identical halves so translateX(-50%) loops seamlessly.
  const half = (
    <div className="flex shrink-0 items-center gap-[18px] pr-[18px] lg:gap-[26px] lg:pr-[26px]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-[18px] lg:gap-[26px]">
          <span className="whitespace-nowrap font-display text-lg uppercase tracking-[1.4px] lg:text-2xl">{item}</span>
          <Icon name="sparkle" className="size-4 lg:size-[18px]" />
        </span>
      ))}
    </div>
  );
  return (
    <div aria-hidden className={cn("sb-ribbon absolute -left-[10vw] w-[120vw] overflow-hidden py-3.5 text-sb-ink lg:py-[18px]", className)}>
      <div className={cn("flex w-max animate-marquee", reverse && "sb-marquee-reverse")} style={{ animationDuration: "48s" }}>
        {half}
        {half}
      </div>
    </div>
  );
}

function Polaroid({ src, srcSet, sizes, loading = "lazy", alt, caption, className, photoClass, captionClass }: { src: string; srcSet?: string; sizes?: string; loading?: "lazy" | "eager"; alt: string; caption: string; className?: string; photoClass?: string; captionClass?: string }) {
  return (
    <figure className={cn("flex flex-col bg-sb-cream transition-[rotate,translate,scale,box-shadow] duration-500 ease-[var(--ease-snap)] hover:z-10 hover:-translate-y-2 hover:rotate-0 hover:scale-[1.03]", className)}>
      <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} loading={loading} decoding="async" className={cn("w-full object-cover", photoClass)} />
      <figcaption className={cn("font-script leading-none text-sb-ink", captionClass)}>{caption}</figcaption>
    </figure>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */

function HomePage() {
  return (
    <AppPage className="sb-home">
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <NorthBrooklyn />
        <Ribbons />
        <WhoYoullMeet />
        <MeetTheMembers />
        <Bricklayer />
        <Scallop from="#f3f0e8" to="#edd22e" />
        <Constellation />
        <Scallop from="#edd22e" to="#0b0b0a" />
        <Founder />
        <Scallop from="#0b0b0a" to="#fcfcfa" />
        <Membership />
        <Faq />
      </main>
      <AppFooter />
    </AppPage>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className={cn(wrap, "relative pb-16 lg:pb-24")}>
      <h1 id="hero-title" className="sb-write relative z-10 -mb-[0.42em] whitespace-nowrap text-center font-script text-[clamp(3.25rem,16.5vw,11.875rem)] leading-none tracking-[-0.03em]" style={delay(HERO_BEATS.headline)}>
        find your people
      </h1>

      <div className="relative">
        <div className="sb-photo-in relative aspect-[358/440] overflow-hidden rounded-[22px] sm:aspect-[16/10] lg:aspect-[1312/600]">
          <img
            src={heroRock}
            srcSet={heroRockSrcSet}
            sizes={heroRockSizes}
            alt="A woman in sunglasses sitting on a sunlit rock beneath a wide blue sky"
            fetchPriority="high"
            className="sb-parallax absolute inset-0 size-full scale-110 object-cover object-[50%_55%]"
            style={{ "--p-from": "-4%", "--p-to": "6%" } as CSSProperties}
          />
          {/* Lightens the sky behind the headline's lower half, so the ink reads. */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-sb-paper/50 to-transparent" />
          <p className="sb-rise absolute bottom-3 left-3 flex items-center gap-2 whitespace-nowrap rounded-full bg-sb-paper/90 px-[18px] py-2.5 font-display text-[13px] uppercase tracking-[1.6px] backdrop-blur-sm max-[359px]:px-3 max-[359px]:text-[11px] lg:bottom-7 lg:left-8" style={delay(HERO_BEATS.chip)}>
            <Icon name="pin" className="size-3.5" />
            Western Queens, New York
          </p>
        </div>
        <div className="sb-drop absolute right-[3%] top-[40%] z-10 w-[120px] min-[360px]:top-[44%] min-[360px]:w-[140px] sm:w-[176px] lg:top-[38%] lg:w-[190px] xl:top-[42%] xl:w-[212px]" style={delay(HERO_BEATS.polaroid)}>
          <Polaroid
            src={queensPolaroid}
            loading="eager"
            alt="Women laughing together at an evening rooftop gathering"
            caption="our people, Queens"
            className={cn("rotate-6 gap-1.5 bg-sb-paper p-2 pb-3 lg:gap-2.5 lg:p-3 lg:pb-4", lift)}
            photoClass="aspect-square"
            captionClass="text-center text-[19px] text-sb-blue-ink lg:text-[26px]"
          />
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-5 lg:mt-9 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <p className="sb-rise max-w-[640px] font-display text-[19px] leading-[1.35] tracking-[0.2px] text-sb-blue-ink lg:flex-1 lg:text-2xl" style={delay(HERO_BEATS.lede)}>
          For women building businesses, careers, creative work, and real relationships close to home.
        </p>
        <div className="flex flex-col lg:contents">
          <Link to="/join" className={cn(inkPill, "sb-rise shrink-0 self-start")} style={delay(HERO_BEATS.cta)}>
            Start your application
          </Link>
          <p aria-hidden className="sb-write mr-4 mt-1 -rotate-6 self-end whitespace-nowrap font-script text-[28px] leading-[27px] text-sb-blue lg:mr-6 lg:mt-0 lg:self-auto lg:text-4xl lg:leading-[34px]" style={delay(HERO_BEATS.note)}>
            &amp; help someone<br />else shine ↓
          </p>
        </div>
      </div>
    </section>
  );
}

// Across Newtown Creek from Long Island City, north to south.
const NORTH_BROOKLYN = [
  { name: "Greenpoint", tone: "bg-sb-olive text-sb-paper" },
  { name: "Williamsburg", tone: "bg-sb-rose text-sb-ink" },
  { name: "East Williamsburg", tone: "bg-sb-shell text-sb-ink" },
  { name: "Bushwick", tone: "bg-sb-terracotta text-sb-paper" },
];

function NorthBrooklyn() {
  return (
    // The scallops sit inside the section so it stays the hero's next sibling.
    <section aria-labelledby="brooklyn-title" className="bg-sb-mustard">
      <Scallop from="#fcfcfa" to="#d9ae5c" />
      <div className={cn(wrap, band, "grid items-center gap-x-16 gap-y-12 lg:grid-cols-[1.2fr_1fr] xl:gap-x-24")}>
        <div className="flex flex-col gap-6 px-2 lg:px-4">
          <div className={cn("relative -rotate-2 bg-sb-paper p-3.5 pb-[18px]", lift)}>
            <span aria-hidden className={cn(tape, "-top-3 left-[19%] -rotate-6")} />
            <span aria-hidden className={cn(tape, "-top-2.5 right-[13%] rotate-5")} />
            <svg viewBox="0 0 640 460" role="img" aria-label="Hand-drawn map: Greenpoint, Williamsburg, East Williamsburg and Bushwick across Newtown Creek from Long Island City, with Nataša’s studio marked in Greenpoint" className="block h-auto w-full">
              <rect width="640" height="460" className="fill-sb-paper" />
              <path d="M0 0 L168 0 C178 40 196 80 190 118 C184 160 168 200 178 246 C188 300 218 360 250 460 L0 460 Z" className="fill-sb-mint" />
              <path d="M184 112 C230 122 280 132 330 128 C380 124 412 108 444 128 C478 150 500 182 540 196 C572 208 610 206 640 214" fill="none" strokeWidth="16" strokeLinecap="round" className="stroke-sb-mint" />
              <path d="M196 138 C240 146 290 152 330 148 C372 144 410 130 440 148 C470 166 494 196 534 214 C570 230 596 262 606 300 C616 344 604 392 588 430 L420 444 C360 446 300 438 262 420 C238 380 214 330 200 280 C190 236 192 190 196 138 Z" fillOpacity=".55" strokeWidth="2.5" strokeLinejoin="round" className="fill-sb-sun stroke-sb-ink" />
              <g fill="none" strokeWidth="1.5" strokeDasharray="6 6" opacity=".6" className="stroke-sb-ink">
                <path d="M196 226 C260 232 330 228 410 214 C440 208 470 200 500 196" />
                <path d="M330 228 C344 290 352 360 360 442" />
                <path d="M352 332 C420 330 500 320 600 316" />
              </g>
              <g className="fill-sb-ink font-script">
                <text x="250" y="196" fontSize="28">Greenpoint</text>
                <text x="216" y="300" fontSize="28">Williamsburg</text>
                <text x="376" y="276" fontSize="26">East Williamsburg</text>
                <text x="430" y="392" fontSize="28">Bushwick</text>
                <text x="250" y="66" fontSize="24" className="fill-sb-blue-ink">Long Island City</text>
                <text x="24" y="210" fontSize="22" className="fill-sb-blue-ink">East River</text>
              </g>
              <circle cx="238" cy="58" r="6" className="fill-lic" />
              <text x="296" y="176" fontSize="28" className="fill-sb-blue font-script">✶</text>
            </svg>
          </div>
          <p className="-rotate-2 font-script text-[22px] leading-[1.15] lg:text-[28px]">✶ Nataša’s studio, Greenpoint</p>
        </div>

        <div className="flex flex-col gap-5">
          <p className={script}>just across the creek</p>
          <h2 id="brooklyn-title" className={cn(h2, "motion-scroll-reveal")}>
            Our neighbors in North Brooklyn.
          </h2>
          <p className="motion-scroll-reveal max-w-[440px] font-geist text-[17px] leading-[1.6]">
            Greenpoint, Williamsburg, East Williamsburg and Bushwick sit across Newtown Creek from Long Island City.
          </p>
          <ul className="grid max-w-[480px] grid-cols-2 gap-1.5">
            {NORTH_BROOKLYN.map((n) => (
              <li key={n.name} className={cn("sb-stamp sb-paper flex min-h-[112px] flex-col justify-between gap-3 p-5", n.tone)}>
                <Icon name="sparkle" className="size-4 opacity-60" />
                <span className="font-editorial text-[26px] leading-[1.09] tracking-[0.3px]">{n.name}</span>
              </li>
            ))}
          </ul>
          <Link to="/neighborhoods" className={cn(inkPill, "mt-1 self-start")}>
            Explore the neighborhoods <Icon name="arrow" className="sb-arrow size-3.5" />
          </Link>
        </div>
      </div>
      <Scallop from="#d9ae5c" to="#fcfcfa" />
    </section>
  );
}

function Ribbons() {
  const [paused, setPaused] = useState(false);
  return (
    <section aria-label="Neighborhoods" className="relative h-[136px] lg:h-[170px]">
      {/* WCAG 2.2.2: the loops run past 5 s, so one control stills every looping animation on the page (styles.css). */}
      <button
        type="button"
        aria-pressed={paused}
        aria-label="Pause the page’s moving decorations"
        onClick={() => setPaused((p) => !p)}
        className="sb-still absolute bottom-0 right-4 z-20 grid size-9 place-items-center rounded-full bg-sb-paper/90 text-sb-ink shadow-[0_4px_14px_rgb(31_31_28/0.18)] outline-none focus-visible:ring-2 focus-visible:ring-sb-blue-ink motion-reduce:hidden lg:right-16"
      >
        <Icon name={paused ? "play" : "pause"} className="size-3.5" />
      </button>
      <p className="sr-only">Across {NEIGHBORHOODS.join(", ")}.</p>
      <Ribbon items={Array.from({ length: 10 }, () => "Find your people")} className="top-[62px] rotate-[2.5deg] bg-sb-mint lg:top-10" />
      <Ribbon items={[...NEIGHBORHOODS, ...NEIGHBORHOODS]} className="top-6 z-10 -rotate-3 bg-sb-lilac lg:top-28" reverse />
    </section>
  );
}

const role = "inline-block transition-[color,rotate,translate] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 hover:-rotate-2 hover:text-sb-blue";

function WhoYoullMeet() {
  return (
    <section id="mission" aria-labelledby="meet-title" className={cn(wrap, "flex scroll-mt-20 flex-col items-center gap-3 pb-[72px] pt-14 text-center lg:gap-5 lg:pb-28 lg:pt-24")}>
      <h2 id="meet-title" className="motion-scroll-reveal font-script text-[clamp(3.625rem,8.4vw,7.5rem)] leading-none text-sb-blue text-balance">
        who you’ll meet here
      </h2>
      <ul className="flex flex-col items-center font-editorial text-[clamp(1.875rem,4.7vw,4.25rem)] italic leading-[1.08] tracking-[-0.5px]">
        {ROLES.map((line, i) => (
          <li key={i} className="motion-scroll-reveal">
            {line.map((r) => (
              <span key={r}>
                <span className={role}>{r}</span>
                <span aria-hidden className="text-sb-ink/25"> / </span>
              </span>
            ))}
          </li>
        ))}
        <li className="motion-scroll-reveal">
          <span className={role}>longtime locals</span> <span className="text-sb-ink/25">&amp;</span> <span className={role}>brand-new arrivals</span>
        </li>
      </ul>
      <p className="motion-scroll-reveal mt-2.5 font-display text-base leading-[22px] text-sb-muted lg:mt-4 lg:text-xl">
        a generous, engaged community across Queens
      </p>

      <div className="sb-paper mt-12 grid w-full max-w-[1120px] items-center gap-x-14 gap-y-10 rounded-[22px] bg-sb-cream px-6 pb-10 pt-12 text-left lg:mt-20 lg:grid-cols-[280px_1fr] lg:p-14 xl:gap-x-20 xl:px-20">
        <div className="relative mx-auto w-[210px] lg:w-full">
          <span aria-hidden className={cn(tape, "-top-3.5 left-1/2 z-10 -ml-[55px] -rotate-3 bg-sb-paper/85")} />
          <img src={deskFlatlay} alt="" loading="lazy" className={cn("aspect-[230/176] w-full -rotate-4 rounded-[14px] object-cover", lift)} />
        </div>
        <div className="flex flex-col items-start gap-4">
          <h3 className="font-script text-[32px] lowercase leading-none text-sb-blue-ink lg:text-[40px]">Our mission</h3>
          <p className="motion-scroll-reveal font-display text-[clamp(1.5rem,2.5vw,2.125rem)] leading-[1.25] text-balance">
            The Women’s Collective brings women across Queens together to meet, share knowledge, support one another’s work, and build real relationships close to home.
          </p>
          <p className="motion-scroll-reveal max-w-[620px] font-geist text-[17px] leading-[1.6] text-sb-muted">
            When women know who is around them, they can recommend each other, collaborate, show up for each other’s events, and create opportunities that would be harder to build alone.
          </p>
          <Link to="/join" className={cn(inkPill, "mt-2")}>
            Introduce yourself <Icon name="arrow" className="sb-arrow size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Board rhythm for up to five polaroids: alternating tilt, staggered drop on the single desktop row.
const TILTS = ["-rotate-5", "rotate-3 lg:mt-7", "-rotate-2 lg:mt-11", "rotate-4 lg:mt-7", "-rotate-4"];

function MeetTheMembers() {
  // Only members who opted in (§2.10), and only those with a portrait: never a stand-in, never demo people.
  // Loading, empty or failed: the row is left out and the heading and directory link stand alone.
  const portraits = (useQuery({ ...publicProfilesQuery, initialData: Route.useLoaderData() }).data ?? [])
    .filter((m): m is MemberProfile & { image: string } => !!m.image)
    .slice(0, TILTS.length);
  return (
    <section aria-labelledby="members-title" className={cn(wrap, "flex flex-col items-center gap-8 pb-[72px] text-center lg:pb-28")}>
      <div className="flex flex-col items-center gap-2.5">
        <p className={cn(script, "text-sb-blue-ink")}>meet the members</p>
        <h2 id="members-title" className={cn(h2, "motion-scroll-reveal")}>Women doing remarkable work nearby.</h2>
        <p className="max-w-[560px] font-geist text-[17px] leading-[1.6] text-sb-muted">Discover the people, practices, and ideas taking shape across Queens.</p>
      </div>
      {portraits.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-7 px-2 pb-6 pt-3">
          {portraits.map((m, i) => (
            <li key={m.id} className="w-[146px] min-[400px]:w-[160px] sm:w-[180px] lg:w-[190px]">
              <Polaroid
                src={m.image}
                alt={m.imageAlt ?? `Portrait of ${m.name}`}
                caption={[m.name.split(" ")[0], m.neighborhood].filter(Boolean).join(", ")}
                className={cn("gap-1.5 bg-sb-paper p-2.5 pb-3 lg:p-3 lg:pb-4", lift, TILTS[i])}
                photoClass="aspect-[4/5]"
                captionClass="text-center text-[22px] text-sb-blue-ink lg:text-[24px]"
              />
            </li>
          ))}
        </ul>
      )}
      <Link to="/members" className={inkPill}>
        View the member directory <Icon name="arrow" className="sb-arrow size-3.5" />
      </Link>
    </section>
  );
}

function Brick({ title, text, tone }: (typeof BRICKS)[number]) {
  return (
    <article className={cn("sb-stamp sb-paper motion-scroll-reveal flex min-h-[230px] flex-col justify-between gap-8 p-7 lg:min-h-[300px] xl:p-9", tone)}>
      <Icon name="sparkle" className="size-5 opacity-60" />
      <div className="flex flex-col gap-2.5">
        <h3 className="font-editorial text-[32px] leading-[1.09] tracking-[0.3px] xl:text-[38px]">{title}</h3>
        <p className="max-w-[36ch] font-geist text-base leading-6">{text}</p>
      </div>
    </article>
  );
}

function Bricklayer() {
  const [share, collab, show] = BRICKS;
  return (
    // Rows use min-heights, never fixed ones, so copy can't spill out of a brick at in-between widths.
    <section id="take-part" aria-labelledby="bricks-title" className="scroll-mt-20 bg-sb-cream">
      <div className="mx-auto grid max-w-[1440px] gap-2 p-2 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="sb-stamp sb-paper flex flex-col justify-between gap-12 bg-sb-olive px-7 pb-8 pt-9 text-white md:col-span-2 lg:col-span-1 lg:row-span-2 lg:px-10 lg:py-12">
          <h2 id="bricks-title" className="font-editorial text-[clamp(2.25rem,3.3vw,3.125rem)] leading-[1.06] tracking-[0.3px] text-balance">Connections that move work forward.</h2>
          <p className="max-w-[34ch] font-geist text-[17px] leading-[26px] text-white/90">Not networking for networking’s sake. This is a place to build genuine relationships and support women-owned work.</p>
        </div>
        <Brick {...share} />
        <div className="sb-stamp group h-[230px] overflow-hidden md:h-auto">
          <img src={gathering} srcSet={eventSrcSet} sizes={eventSizes} alt="Women talking together at a collective gathering" loading="lazy" className="size-full object-cover transition-[scale] duration-700 ease-[var(--ease-gentle)] group-hover:scale-105" />
        </div>
        <Brick {...collab} />
        <Brick {...show} />
      </div>
    </section>
  );
}

function Constellation() {
  const hoods = useNeighborhoods().data.filter((n) => n.active);
  return (
    <section id="constellation" aria-labelledby="constellation-title" className="scroll-mt-20 bg-sb-sun">
      <div className={cn(wrap, "grid grid-cols-2 items-center gap-x-4 gap-y-10 pb-[72px] pt-14 lg:grid-cols-[260px_1fr_260px] lg:gap-x-10 lg:gap-y-16 lg:pb-28 lg:pt-20 xl:grid-cols-[300px_1fr_300px] min-[1440px]:grid-cols-[340px_1fr_340px]")}>
        <div className="group h-[250px] w-full max-w-[340px] justify-self-center overflow-hidden rounded-[170px_170px_8px_8px] sm:h-[380px] lg:h-[460px]">
          <img src={balconyFriends} alt="Two friends leaning on a balcony railing, faces turned to the sky" loading="lazy" className="size-full object-cover transition-[scale] duration-700 ease-[var(--ease-gentle)] group-hover:scale-105" />
        </div>

        <div className="col-span-2 -order-1 flex flex-col items-center gap-5 text-center lg:order-none lg:col-span-1 lg:gap-6">
          <div className="sb-float">
            <ConstellationLogo variant="ink" alt="" loading="lazy" sizes="(min-width: 64rem) 112px, 96px" className="w-24 transition-[rotate] duration-700 ease-[var(--ease-snap)] hover:rotate-[72deg] lg:w-[112px]" />
          </div>
          <p className={cn(script, "motion-scroll-reveal rotate-3")}>our constellation</p>
          <h2 id="constellation-title" className={cn(h2, "motion-scroll-reveal")}>
            Every connection makes the whole community stronger
          </h2>
          <p className="motion-scroll-reveal max-w-[440px] font-geist text-[17px] leading-[1.6]">
            Each neighborhood has its own identity and color. The central star is the point where those neighborhoods and connections meet.
          </p>
          <Link to="/members" className={cn(pill, "mt-1 px-[22px] py-3 text-[13px] ring-[1.5px] ring-sb-ink ring-inset hover:bg-sb-ink hover:text-sb-sun")}>
            Meet the members <Icon name="arrow" className="sb-arrow size-3.5" />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-3 lg:gap-5">
          <div className="group size-[150px] overflow-hidden rounded-full sm:size-[240px] lg:size-[250px] xl:size-[290px]">
            <img src={neighbors} alt="Hands shaping a handmade ceramic cup in a sunny studio" loading="lazy" className="size-full object-cover transition-[scale,rotate] duration-700 ease-[var(--ease-gentle)] group-hover:rotate-6 group-hover:scale-110" />
          </div>
          <p className="-rotate-3 text-center font-script text-[22px] leading-[23px] lg:text-[30px] lg:leading-normal">neighbors → collaborators</p>
        </div>

        <ul aria-label="Neighborhood colors" className="col-span-2 flex flex-wrap justify-center gap-2 font-display text-sm leading-[1.4] tracking-[0.3px] lg:col-span-3">
          {hoods.map((n) => (
            <li key={n.slug} className="inline-flex items-center gap-2 rounded-full bg-sb-paper/55 px-3.5 py-1.5">
              <span aria-hidden className="twc-dot bg-(--hood)" style={{ "--hood": n.color } as CSSProperties} />
              {n.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section aria-labelledby="founder-title" className="bg-sb-night text-sb-paper">
      <div className={cn(wrap, band, "flex flex-col items-center gap-10 lg:flex-row lg:gap-14 xl:gap-24")}>
        {/* The frame's ratio is the stack's own, so the band closes right under the photos. */}
        <div className="relative aspect-[6/5] w-full max-w-[350px] shrink-0 lg:max-w-[440px] xl:max-w-[540px]">
          <Polaroid
            src={gathering}
            srcSet={eventSrcSet}
            sizes={eventPolaroidSizes}
            alt="Members of the collective together in person"
            caption="the collective, in person"
            captionClass="text-right text-xl lg:text-[28px]"
            className={cn("absolute left-[46%] top-[20%] w-1/2 -rotate-5 gap-2 p-2.5 pb-3 lg:gap-3 lg:p-3.5 lg:pb-[18px]", liftNight)}
            photoClass="aspect-[176/128] lg:aspect-[262/250]"
          />
          <Polaroid
            src={natasaFounder}
            alt="Portrait of Nataša Tuohy, founder of The Women’s Collective"
            caption="Nataša, founder ✶"
            className={cn("absolute left-[4%] top-0 w-[56%] rotate-5 gap-2 p-2.5 pb-3 lg:gap-3 lg:p-3.5 lg:pb-[18px]", liftNight)}
            photoClass="aspect-[180/212] lg:aspect-[292/360]"
            captionClass="text-xl lg:text-[28px]"
          />
          <Icon name="clip" className="pointer-events-none absolute -top-5 left-[27%] z-20 h-11 w-[30px] rotate-[20deg] text-[#c9c9c4] lg:-top-7 lg:h-16 lg:w-11" />
        </div>

        <div className="flex w-full flex-col gap-5 lg:flex-1 lg:gap-6">
          <div className="flex items-end gap-2.5 lg:gap-[18px]">
            <h2 id="founder-title" className="motion-scroll-reveal whitespace-nowrap font-display text-[clamp(3.125rem,5.8vw,5.25rem)] leading-none">Meet Nataša</h2>
            <span aria-hidden className="mb-[0.4em] inline-block rotate-6 font-script text-[32px] leading-none text-sb-sun transition-[rotate,scale] duration-300 hover:-rotate-6 hover:scale-110 lg:text-[52px]">(hi!)</span>
          </div>
          <p className="motion-scroll-reveal max-w-[560px] font-geist text-[17px] leading-7 text-sb-paper/75">
            Nataša Tuohy is a New York–based architectural and interior designer whose work brings European sensibility together with New York pragmatism. Educated at the University of Florence, she founded her Greenpoint studio around thoughtful spaces, trusted collaboration, and enduring relationships.
          </p>
          <a href="https://natasatuohy.com/about/" target="_blank" rel="noreferrer" className={cn(pill, "mt-1 w-fit bg-sb-sun px-6 py-3.5 text-sm text-sb-ink hover:bg-[#f5dc3c] focus-visible:ring-offset-sb-night")}>
            Visit Nataša’s studio <Icon name="arrowUp" className="sb-arrow sb-arrow-up size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function YourStar({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("items-center gap-2.5 font-script text-2xl tracking-normal text-sb-sun lg:text-[30px]", className)}>
      <span className="sb-twinkle inline-block size-6 shrink-0 rounded-full border-[1.5px] border-sb-sun lg:size-7" />
      <span className="inline-block rotate-3 whitespace-nowrap">← that’s you</span>
    </span>
  );
}

function Membership() {
  return (
    <section aria-labelledby="apply-title" className={cn(wrap, band)}>
      <div className="relative">
        <div aria-hidden className="absolute -top-3.5 left-5 z-10 h-7 w-[100px] -rotate-5 bg-[#F3ECE4]/80 lg:-top-4 lg:left-8 lg:h-[34px] lg:w-[132px]" />
        <div className="group relative flex flex-col overflow-hidden rounded-md text-sb-paper lg:flex-row">
          <img src={nightSky} alt="" loading="lazy" className="absolute inset-0 size-full -scale-x-100 object-cover transition-[scale] duration-[2s] ease-[var(--ease-gentle)] group-hover:-scale-x-105 group-hover:scale-y-105" />
          <div aria-hidden className="absolute inset-0 bg-linear-to-b from-[#0A0F2E33] to-[#0A0F2EB8] lg:bg-linear-to-r" />

          <div className="relative flex flex-1 flex-col justify-center gap-2 px-6 pb-9 pt-11 lg:gap-3 lg:py-[72px] lg:pl-16 lg:pr-14">
            <p className="motion-scroll-reveal origin-left rotate-3 font-script text-[28px] text-sb-sun lg:text-4xl">psst — there’s a seat for you</p>
            <h2 id="apply-title" className="motion-scroll-reveal font-display text-[clamp(2.875rem,6.1vw,5.5rem)] leading-[1.03] tracking-[-0.02em]">
              There is room in this constellation.{" "}
              <YourStar className="relative top-[-0.15em] hidden align-middle sm:inline-flex" />
            </h2>
            <YourStar className="mt-1 flex sm:hidden" />
          </div>

          <div aria-hidden className="relative flex h-7 items-center lg:h-auto lg:w-7 lg:flex-col">
            <span className="relative h-7 w-3.5 overflow-hidden lg:h-3.5 lg:w-7"><span className="absolute -left-3.5 top-0 size-7 rounded-full bg-sb-paper lg:-top-3.5 lg:left-0" /></span>
            <span className="h-1.5 flex-1 bg-[radial-gradient(circle,rgb(255_255_255/0.8)_1.2px,transparent_1.7px)] bg-[length:12px_6px] bg-repeat-x lg:h-auto lg:w-1.5 lg:bg-[length:6px_12px] lg:bg-repeat-y" />
            <span className="relative h-7 w-3.5 overflow-hidden lg:h-3.5 lg:w-7"><span className="absolute left-0 top-0 size-7 rounded-full bg-sb-paper" /></span>
          </div>

          <div className="relative flex flex-col justify-between gap-8 px-6 pb-9 pt-7 transition-[translate,rotate] duration-500 ease-[var(--ease-snap)] lg:w-[400px] lg:origin-left lg:py-14 lg:pl-10 lg:pr-12 lg:group-hover:translate-x-1.5 lg:group-hover:rotate-1">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3 font-fragment text-[13px]">
                <span className="tracking-[2px]">ADMIT ONE</span>
                <span className="tracking-[1px] text-sb-paper/65">Nº 0001 — QUEENS</span>
              </div>
              <p className="font-geist text-[17px] leading-[27px] text-sb-paper/85">The application helps us learn about you, your work, and how you would like to participate in the community.</p>
            </div>
            <Link to="/join" className={cn(pill, "w-fit gap-2.5 bg-sb-paper px-[26px] py-4 text-sm text-sb-blue-ink focus-visible:ring-sb-paper focus-visible:ring-offset-transparent max-[359px]:px-5 max-[359px]:text-[13px]")}>
              Start your application <Icon name="arrow" className="sb-arrow size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className={cn(wrap, "flex scroll-mt-20 flex-col gap-9 pb-20 lg:flex-row lg:gap-24 lg:pb-32")}>
      <div className="flex flex-col gap-2.5 lg:w-[380px] lg:shrink-0 lg:gap-3.5">
        <span className={cn(script, "text-sb-blue")}>come as you are</span>
        <h2 id="faq-title" className="font-display text-[42px] leading-[1.03] tracking-[-1px] lg:text-[64px]">Questions, answered.</h2>
        <div className="flex flex-col gap-[18px] pt-3.5">
          <p className="font-geist text-[17px] leading-[1.6] text-sb-muted">Still wondering about something? Send us a note — a real person in Queens reads every one.</p>
          <Link to="/contact" className={moreLink}>
            <span className="sb-link">Ask us anything</span> <Icon name="arrow" className="size-4 transition-[translate] duration-300 group-hover:translate-x-[3px]" />
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {FAQ.map((item, i) => (
          <details key={item.q} name="faq" open={i === 0} className="sb-faq group rounded-md border-b border-sb-ink/15 transition-[background-color,border-color] duration-500 open:border-transparent open:bg-sb-mint">
            <summary className="flex cursor-pointer items-center gap-4 rounded-md px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-sb-blue lg:px-8 lg:py-[26px]">
              <span className="flex-1 font-display text-[19px] leading-[23px] transition-[translate] duration-300 group-hover:translate-x-1 lg:text-[26px] lg:leading-tight">{item.q}</span>
              <span className="sb-toggle grid size-9 shrink-0 place-items-center rounded-full bg-sb-paper ring-1 ring-sb-ink/25 group-open:bg-sb-ink group-open:text-sb-paper group-open:ring-0 lg:size-11">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden className="size-[18px]">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" className="origin-center transition-[scale] duration-300 group-open:scale-y-0" />
                </svg>
              </span>
            </summary>
            <p className="max-w-[62ch] px-4 pb-7 font-geist text-[15px] leading-6 lg:px-8 lg:pb-9 lg:text-[17px] lg:leading-[27px]">{item.a}</p>
          </details>
        ))}
        <Link to="/faq" className={cn(moreLink, "mt-6 lg:ml-8")}>
          <span className="sb-link">More questions</span> <Icon name="arrow" className="size-4 transition-[translate] duration-300 group-hover:translate-x-[3px]" />
        </Link>
      </div>
    </section>
  );
}
