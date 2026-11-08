import { Link, createFileRoute } from "@tanstack/react-router";
import { useRef, type CSSProperties } from "react";
import { ConstellationLogo, cn } from "@/index";
import heroRock from "@/assets/photography/home/hero-rock.webp";
import queensPolaroid from "@/assets/photography/home/queens-polaroid.webp";
import deskFlatlay from "@/assets/photography/home/desk-flatlay.webp";
import balconyFriends from "@/assets/photography/home/balcony-friends.webp";
import neighbors from "@/assets/photography/home/neighbors.webp";
import natasaFounder from "@/assets/photography/home/natasa-founder.webp";
import nightSky from "@/assets/photography/home/night-sky.webp";
import gathering from "@/assets/photography/event.jpg";
import caveatUrl from "@/assets/fonts/home/caveat-400.woff2?url";

export const Route = createFileRoute("/home-v2")({
  head: () => ({
    meta: [
      { title: "The Women’s Collective — Find your people in Queens" },
      { name: "description", content: "A community for women building businesses, careers, creative work, and real relationships close to home in Western Queens." },
      { property: "og:title", content: "The Women’s Collective — Find your people in Queens" },
      { property: "og:description", content: "Find your people, share what you do, and help someone else shine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Preview of the next homepage — drop noindex once it replaces /.
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "preload", href: caveatUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" }],
  }),
  component: HomeV2Page,
});

/* ── data ─────────────────────────────────────────────────────────────── */

const NEIGHBORHOODS = ["Long Island City", "Astoria", "Sunnyside", "Woodside", "Jackson Heights", "Elmhurst", "Forest Hills", "Rego Park"];
const ROLES = [
  ["founders", "makers", "creatives"],
  ["career-builders", "neighbors", "artists"],
  ["shop owners", "organizers", "daydreamers"],
];
const BRICKS = [
  { no: "01", title: "Share what you do", text: "Introduce your business, work, or project and help neighbors understand what you bring.", tone: "bg-[#D9AE5C] text-[#1A1A1A]" },
  { no: "02", title: "Find collaborators", text: "Build partnerships, exchange referrals, and discover opportunities through people nearby.", tone: "bg-[#FAF6EE] text-[#1A1A1A]" },
  { no: "03", title: "Show up locally", text: "Promote women-owned businesses and learn about gatherings, events, and meetups across Queens.", tone: "bg-[#B85A45] text-white" },
];

// TODO(human): replace the fourth answer with what actually happens after someone applies.
const FAQ = [
  { q: "Who is the collective for?", a: "Women in Queens who are building something — a business, a career, a creative practice — and want real relationships close to home. Founders, freelancers, makers, and the newly curious are all welcome. No follower count or pitch deck required." },
  { q: "Which neighborhoods are included?", a: "Long Island City, Astoria, Sunnyside, Woodside, Jackson Heights, Elmhurst, East Elmhurst, Forest Hills, Rego Park, and surrounding Queens neighborhoods." },
  { q: "Is the community inclusive?", a: "Yes. We welcome women from all backgrounds, including moms, married and single women, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, international members, and people from diverse cultures." },
  { q: "What happens after I apply?", a: "A real person in Queens reads every application. We’ll be in touch by email about next steps." },
];

/* ── small pieces ─────────────────────────────────────────────────────── */

const ICONS = {
  pin: <><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  sparkle: <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  arrowUp: <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  clip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
};

function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("shrink-0", className)}>
      {ICONS[name]}
    </svg>
  );
}

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const pill = "sb-pill inline-flex items-center gap-2 rounded-full font-display uppercase tracking-[1.6px] outline-none focus-visible:ring-2 focus-visible:ring-sb-blue focus-visible:ring-offset-2";
const navLink = "sb-link font-display text-[15px] tracking-[0.3px] outline-none focus-visible:text-sb-blue";

function Scallop({ from, to }: { from: string; to: string }) {
  return <div aria-hidden className="sb-scallop w-full" style={{ "--from": from, "--to": to } as CSSProperties} />;
}

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

function Polaroid({ src, alt, caption, className, photoClass, captionClass }: { src: string; alt: string; caption: string; className?: string; photoClass?: string; captionClass?: string }) {
  return (
    <figure className={cn("flex flex-col bg-sb-cream transition-[rotate,translate,scale,box-shadow] duration-500 ease-[var(--ease-snap)] hover:z-10 hover:-translate-y-2 hover:rotate-0 hover:scale-[1.03]", className)}>
      <img src={src} alt={alt} loading="lazy" decoding="async" className={cn("w-full object-cover", photoClass)} />
      <figcaption className={cn("font-script leading-none text-sb-ink", captionClass)}>{caption}</figcaption>
    </figure>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */

function HomeV2Page() {
  return (
    <div className="sb-home min-h-screen overflow-x-clip bg-sb-paper text-sb-ink">
      <a href="#main" className="sr-only z-50 rounded-full bg-sb-ink px-4 py-2 text-sb-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Ribbons />
        <WhoYoullMeet />
        <Bricklayer />
        <Scallop from="#f3f0e8" to="#edd22e" />
        <Constellation />
        <Scallop from="#edd22e" to="#0b0b0a" />
        <Founder />
        <Scallop from="#0b0b0a" to="#fcfcfa" />
        <Membership />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}

function Nav() {
  const menu = useRef<HTMLDivElement>(null);
  const close = () => menu.current?.hidePopover();
  const menuLinks: { label: string; href?: string; to?: "/members" | "/join" | "/account" }[] = [
    { label: "Our mission", href: "#mission" },
    { label: "Members", to: "/members" },
    { label: "Take part", href: "#take-part" },
    { label: "Our constellation", href: "#constellation" },
    { label: "Questions", href: "#faq" },
    { label: "Sign in", to: "/account" },
  ];
  const brand = (
    <Link to="/home-v2" className="group flex items-center gap-2 outline-none focus-visible:text-sb-blue lg:gap-2.5" aria-label="The Women’s Collective — home">
      <ConstellationLogo variant="ink" alt="" className="w-7 transition-[rotate] duration-500 ease-[var(--ease-snap)] group-hover:rotate-[24deg] lg:w-[34px]" />
      <span className="whitespace-nowrap font-display text-[17px] max-[359px]:sr-only lg:text-[22px]">The Women’s Collective</span>
    </Link>
  );
  return (
    <header className="sb-nav sticky top-0 z-40">
      {/* Desktop */}
      <nav aria-label="Primary" className="hidden items-center justify-between px-16 py-6 lg:flex">
        <a href="#mission" className={navLink}>Our mission</a>
        <Link to="/members" className={navLink}>Members</Link>
        {brand}
        <a href="#take-part" className={navLink}>Take part</a>
        <Link to="/join" className={cn(pill, "bg-sb-blue px-5 py-2.5 text-sm text-sb-paper hover:bg-[#1878be]")}>Join us</Link>
      </nav>
      {/* Mobile */}
      <div className="flex items-center justify-between px-5 py-4 lg:hidden">
        {brand}
        <div className="flex items-center gap-3.5">
          <Link to="/join" className={cn(pill, "bg-sb-blue px-3.5 py-2 text-xs text-sb-paper")}>Join us</Link>
          <button type="button" popoverTarget="sb-menu" aria-label="Open menu" className="-m-2 rounded-full p-2 outline-none transition-[scale] active:scale-90 focus-visible:ring-2 focus-visible:ring-sb-blue">
            <Icon name="menu" className="size-[22px]" />
          </button>
        </div>
      </div>
      <div ref={menu} id="sb-menu" popover="auto" className="sb-menu bg-sb-lilac text-sb-ink">
        <div className="flex h-full flex-col px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="font-script text-3xl">find your people</span>
            <button type="button" popoverTarget="sb-menu" popoverTargetAction="hide" aria-label="Close menu" className="-m-2 rounded-full p-2 outline-none transition-[rotate] duration-300 hover:rotate-90 focus-visible:ring-2 focus-visible:ring-sb-blue">
              <Icon name="close" className="size-6" />
            </button>
          </div>
          <nav aria-label="Mobile" className="mt-10 flex flex-col">
            {menuLinks.map((l, i) => {
              const cls = "sb-menu-item flex items-baseline justify-between border-b border-sb-ink/15 py-4 font-display text-[34px] leading-tight outline-none focus-visible:text-sb-blue";
              const body = <>{l.label}<span className="font-fragment text-xs text-sb-ink/60">0{i + 1}</span></>;
              return l.to
                ? <Link key={l.label} to={l.to} onClick={close} className={cls} style={delay(60 + i * 50)}>{body}</Link>
                : <a key={l.label} href={l.href} onClick={close} className={cls} style={delay(60 + i * 50)}>{body}</a>;
            })}
          </nav>
          <Link to="/join" onClick={close} className={cn(pill, "sb-menu-item mt-auto justify-center bg-sb-ink py-4 text-sm text-sb-paper")} style={delay(400)}>
            Start your application <Icon name="arrow" className="sb-arrow size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative px-4 pb-14 lg:px-16 lg:pb-20">
      <h1 id="hero-title" className="sb-write relative z-10 text-center font-script whitespace-nowrap text-[clamp(3.25rem,16.5vw,11.875rem)] leading-none tracking-[-0.03em] -mb-[0.42em]" style={delay(250)}>
        find your people
      </h1>

      <div className="relative">
        <div className="sb-photo-in relative aspect-[358/440] overflow-hidden rounded-[22px] sm:aspect-[16/10] lg:aspect-[1312/600]">
          <img
            src={heroRock}
            alt="A woman in sunglasses sitting on a sunlit rock beneath a wide blue sky"
            fetchPriority="high"
            className="sb-parallax absolute inset-0 size-full scale-110 object-cover object-[50%_55%]"
            style={{ "--p-from": "-4%", "--p-to": "6%" } as CSSProperties}
          />
          <p className="sb-rise absolute bottom-3 left-3 flex items-center gap-2 whitespace-nowrap rounded-full bg-sb-paper/90 px-[18px] py-2.5 font-display text-[13px] uppercase tracking-[1.6px] max-[359px]:px-3 max-[359px]:text-[11px] backdrop-blur-sm lg:bottom-7 lg:left-8" style={delay(900)}>
            <Icon name="pin" className="size-3.5" />
            Western Queens, New York
          </p>
        </div>
        <div className="sb-drop absolute right-[3%] top-[40%] z-10 w-[120px] min-[360px]:top-[44%] min-[360px]:w-[140px] sm:w-[176px] lg:top-[38%] lg:w-[190px] xl:top-[46%] xl:w-[212px]" style={delay(1100)}>
          <Polaroid
            src={queensPolaroid}
            alt="Women laughing together at an evening rooftop gathering"
            caption="our people, Queens"
            className="rotate-6 gap-1.5 bg-sb-paper p-2 pb-3 shadow-[0_10px_28px_rgb(31_31_28/0.2)] lg:gap-2.5 lg:p-3 lg:pb-4"
            photoClass="aspect-[124/124] lg:aspect-[188/188]"
            captionClass="text-center text-[19px] text-sb-blue lg:text-[26px]"
          />
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-5 lg:mt-8 xl:flex-row xl:items-start xl:justify-between xl:gap-10">
        <p className="sb-rise max-w-[760px] font-display text-[17px] leading-[23px] tracking-[0.4px] text-sb-blue lg:text-[22px] lg:leading-[29px] xl:flex-1" style={delay(700)}>
          For women building businesses, careers, creative work, and real relationships close to home.
        </p>
        <div className="flex flex-col xl:contents">
          <Link to="/join" className={cn(pill, "sb-rise shrink-0 self-start bg-sb-ink px-6 py-3.5 text-[13px] text-sb-paper hover:bg-black lg:text-sm")} style={delay(850)}>
            Start your application
          </Link>
          <p aria-hidden className="sb-write mr-4 mt-1 -rotate-6 self-end whitespace-nowrap font-script text-[28px] leading-[27px] text-sb-blue lg:text-4xl lg:leading-[34px] xl:mr-6 xl:mt-0 xl:self-auto" style={delay(1500)}>
            &amp; help someone<br />else shine ↓
          </p>
        </div>
      </div>
    </section>
  );
}

function Ribbons() {
  return (
    <section aria-label="Neighborhoods" className="relative h-[136px] lg:h-[170px]">
      <p className="sr-only">Across {NEIGHBORHOODS.join(", ")}.</p>
      <Ribbon items={Array.from({ length: 10 }, () => "Find your people")} className="top-[62px] rotate-[2.5deg] bg-sb-mint lg:top-10" />
      <Ribbon items={[...NEIGHBORHOODS, ...NEIGHBORHOODS]} className="top-6 z-10 -rotate-3 bg-sb-lilac lg:top-28" reverse />
    </section>
  );
}

function WhoYoullMeet() {
  return (
    <section id="mission" aria-labelledby="meet-title" className="relative flex scroll-mt-20 flex-col items-center gap-2.5 px-5 pb-[72px] pt-[164px] text-center lg:gap-5 lg:px-16 lg:pb-[120px] lg:pt-24">
      <div className="absolute left-1/2 top-5 -ml-[78px] w-[156px] lg:left-[66px] lg:top-14 lg:ml-0 lg:w-[230px]">
        <img
          src={deskFlatlay}
          alt=""
          loading="lazy"
          className="sb-parallax aspect-[230/176] w-full -rotate-6 rounded-[14px] object-cover shadow-[0_14px_30px_-18px_rgb(31_31_28/0.5)]"
          style={{ "--p-from": "30px", "--p-to": "-30px" } as CSSProperties}
        />
      </div>
      <h2 id="meet-title" className="motion-scroll-reveal relative font-script text-[clamp(3.625rem,8.4vw,7.5rem)] leading-none text-sb-blue text-balance">
        who you’ll meet here
      </h2>
      <ul className="relative flex flex-col items-center font-editorial text-[clamp(1.875rem,4.7vw,4.25rem)] italic leading-[1.06] tracking-[-0.5px]">
        {ROLES.map((line, i) => (
          <li key={i} className="motion-scroll-reveal">
            {line.map((role) => (
              <span key={role}>
                <span className="inline-block transition-[color,rotate,translate] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 hover:-rotate-2 hover:text-sb-blue">{role}</span>{" / "}
              </span>
            ))}
          </li>
        ))}
        <li className="motion-scroll-reveal">
          <span className="inline-block transition-[color,rotate] duration-300 hover:-rotate-1 hover:text-sb-blue">longtime locals</span> &amp;{" "}
          <span className="inline-block transition-[color,rotate] duration-300 hover:rotate-1 hover:text-sb-blue">brand-new arrivals</span>
        </li>
      </ul>
      <p className="motion-scroll-reveal relative mt-2.5 font-display text-base leading-[22px] text-sb-muted lg:mt-5 lg:text-xl">
        a generous, engaged community across Queens
      </p>
    </section>
  );
}

function Brick({ no, title, text, tone, className }: (typeof BRICKS)[number] & { className?: string }) {
  return (
    <article className={cn("motion-scroll-reveal flex flex-col justify-end gap-2 rounded-lg p-6 py-7 transition-[translate,box-shadow] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgb(0_0_0/0.45)] md:p-9 lg:gap-3.5", tone, className)}>
      <span className="font-fragment text-[13px]">{no}</span>
      <h3 className="font-editorial text-[32px] font-extrabold leading-[1.09] tracking-[1px] lg:text-[40px]">{title}</h3>
      <p className="font-geist text-base leading-6">{text}</p>
    </article>
  );
}

function Bricklayer() {
  const [share, collab, show] = BRICKS;
  return (
    <section id="take-part" aria-labelledby="bricks-title" className="flex scroll-mt-20 flex-col gap-2 bg-sb-cream p-2 lg:h-[624px] lg:flex-row">
      <div className="flex flex-col justify-between gap-12 rounded-lg bg-[#737A4E] px-6 pb-7 pt-8 text-white lg:w-[400px] lg:shrink-0 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-[18px]">
          <span className="font-fragment text-xs text-white/70">INSIDE THE COLLECTIVE</span>
          <h2 id="bricks-title" className="font-editorial text-[34px] font-extrabold leading-[1.09] tracking-[1px] lg:text-[40px]">Connections that move work forward.</h2>
        </div>
        <p className="font-geist text-[17px] leading-[26px] text-white/85">Not networking for networking’s sake. This is a place to build genuine relationships and support women-owned work.</p>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-2 md:h-[300px] md:flex-row">
          <Brick {...share} className="md:flex-1" />
          <div className="group h-[220px] overflow-hidden rounded-lg md:h-full md:w-[38%] lg:w-[300px]">
            <img src={gathering} alt="Women talking together at a collective gathering" loading="lazy" className="size-full object-cover transition-[scale] duration-700 ease-[var(--ease-gentle)] group-hover:scale-105" />
          </div>
        </div>
        <div className="grid grid-cols-[56px_1fr] gap-2 md:flex md:h-[300px]">
          <div aria-hidden className="group grid place-items-center rounded-lg bg-[#E6B5C1] md:w-[96px] lg:w-[150px]">
            <Icon name="sparkle" className="size-5 text-sb-ink/40 transition-[rotate,scale] duration-700 ease-[var(--ease-snap)] group-hover:rotate-180 group-hover:scale-125" />
          </div>
          <Brick {...collab} className="md:flex-1" />
          <Brick {...show} className="col-span-2 md:flex-1" />
        </div>
      </div>
    </section>
  );
}

function Constellation() {
  return (
    <section id="constellation" aria-labelledby="constellation-title" className="grid scroll-mt-20 grid-cols-2 items-center gap-x-4 gap-y-10 bg-sb-sun px-5 pb-[72px] pt-14 lg:grid-cols-[320px_1fr_320px] lg:gap-14 lg:px-16 lg:pb-[120px] lg:pt-[72px]">
      <div className="group h-[250px] w-full max-w-[320px] justify-self-center overflow-hidden rounded-[160px_160px_8px_8px] sm:h-[380px] lg:h-[440px]">
        <img src={balconyFriends} alt="Two friends leaning on a balcony railing, faces turned to the sky" loading="lazy" className="size-full object-cover transition-[scale] duration-700 ease-[var(--ease-gentle)] group-hover:scale-105" />
      </div>

      <div className="col-span-2 -order-1 flex flex-col items-center gap-[22px] text-center lg:order-none lg:col-span-1 lg:gap-7">
        <div className="sb-float">
          <ConstellationLogo variant="ink" alt="" className="w-24 transition-[rotate] duration-700 ease-[var(--ease-snap)] hover:rotate-[72deg] lg:w-[120px]" />
        </div>
        <p className="motion-scroll-reveal rotate-3 font-script text-4xl lg:text-[44px]">our constellation</p>
        <h2 id="constellation-title" className="motion-scroll-reveal font-display text-[clamp(2.25rem,3.75vw,3.375rem)] leading-[1.09] text-balance">
          Every connection makes the whole community stronger
        </h2>
        <p className="motion-scroll-reveal max-w-[440px] font-geist text-base leading-[25px]">
          Each neighborhood has its own identity and color. The central star is the point where those neighborhoods and connections meet.
        </p>
        <Link to="/members" className={cn(pill, "px-[22px] py-3 text-[13px] ring-[1.5px] ring-sb-ink ring-inset hover:bg-sb-ink hover:text-sb-sun")}>
          Meet the members <Icon name="arrow" className="sb-arrow size-3.5" />
        </Link>
      </div>

      <div className="flex flex-col items-center gap-3 lg:gap-5">
        <div className="group size-[150px] overflow-hidden rounded-full sm:size-[240px] lg:size-[300px]">
          <img src={neighbors} alt="Hands shaping a handmade ceramic cup in a sunny studio" loading="lazy" className="size-full object-cover transition-[scale,rotate] duration-700 ease-[var(--ease-gentle)] group-hover:rotate-6 group-hover:scale-110" />
        </div>
        <p className="-rotate-3 text-center font-script text-[22px] leading-[23px] lg:text-[30px] lg:leading-normal">neighbors → collaborators</p>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section aria-labelledby="founder-title" className="flex flex-col items-center gap-9 bg-sb-night px-5 pb-20 pt-16 text-sb-paper lg:flex-row lg:gap-[72px] lg:px-16 lg:pb-[120px] lg:pt-[88px]">
      <div className="relative aspect-square w-full max-w-[350px] shrink-0 lg:aspect-[560/570] lg:max-w-[560px]">
        <Polaroid
          src={gathering}
          alt="Members of the collective together in person"
          caption="the collective, in person"
          captionClass="text-right text-xl lg:text-left lg:text-[28px]"
          className="absolute left-[43%] top-[29%] w-[50%] -rotate-5 gap-2 p-2.5 pb-3 shadow-[0_14px_30px_rgb(0_0_0/0.4)] lg:left-[40%] lg:top-[26%] lg:gap-3 lg:p-3.5 lg:pb-[18px]"
          photoClass="aspect-[176/128] lg:aspect-[262/250]"
        />
        <Polaroid
          src={natasaFounder}
          alt="Portrait of Nataša Tuohy, founder of The Women’s Collective"
          caption="Nataša, founder ✶"
          className="absolute left-[7.5%] top-[8.5%] w-[57%] rotate-5 gap-2 p-2.5 pb-3 shadow-[0_14px_30px_rgb(0_0_0/0.4)] lg:left-[9%] lg:top-[7%] lg:gap-3 lg:p-3.5 lg:pb-[18px]"
          photoClass="aspect-[180/212] lg:aspect-[292/360]"
          captionClass="text-xl lg:text-[28px]"
        />
        <Icon name="clip" className="pointer-events-none absolute left-[32%] top-0 z-20 h-11 w-[30px] rotate-[20deg] text-[#c9c9c4] lg:left-[31%] lg:h-16 lg:w-11" />
      </div>

      <div className="flex w-full flex-col gap-[18px] lg:flex-1 lg:gap-6">
        <span className="font-geist text-xs font-semibold tracking-[2px] text-sb-paper/60">FOUNDER</span>
        <div className="flex items-end gap-2.5 lg:gap-[18px]">
          <h2 id="founder-title" className="motion-scroll-reveal whitespace-nowrap font-display text-[clamp(3.125rem,5.8vw,5.25rem)] leading-none">Meet Nataša</h2>
          <span aria-hidden className="mb-[0.4em] inline-block rotate-6 font-script text-[32px] leading-none text-sb-sun transition-[rotate,scale] duration-300 hover:-rotate-6 hover:scale-110 lg:text-[52px]">(hi!)</span>
        </div>
        <p className="motion-scroll-reveal max-w-[540px] font-geist text-base leading-[26px] text-sb-paper/70 lg:text-[17px] lg:leading-7">
          Nataša Tuohy is a New York–based architectural and interior designer whose work brings European sensibility together with New York pragmatism. Educated at the University of Florence, she founded her Greenpoint studio around thoughtful spaces, trusted collaboration, and enduring relationships.
        </p>
        <a href="https://natasatuohy.com/about/" target="_blank" rel="noreferrer" className={cn(pill, "w-fit bg-sb-sun px-6 py-3.5 text-sm text-sb-ink hover:bg-[#f5dc3c] focus-visible:ring-offset-sb-night")}>
          Visit Nataša’s studio <Icon name="arrowUp" className="sb-arrow sb-arrow-up size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
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
    <section aria-labelledby="apply-title" className="relative px-4 pb-[72px] pt-16 lg:px-16 lg:pb-[104px] lg:pt-24">
      <div aria-hidden className="absolute left-9 top-12 z-10 h-7 w-[100px] -rotate-5 bg-[#F3ECE4]/80 lg:left-24 lg:top-20 lg:h-[34px] lg:w-[132px]" />
      <div className="group relative flex flex-col overflow-hidden rounded-md text-sb-paper lg:flex-row">
        <img src={nightSky} alt="" loading="lazy" className="absolute inset-0 size-full -scale-x-100 object-cover transition-[scale] duration-[2s] ease-[var(--ease-gentle)] group-hover:-scale-x-105 group-hover:scale-y-105" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-b from-[#0A0F2E33] to-[#0A0F2EB8] lg:bg-linear-to-r" />

        <div className="relative flex flex-1 flex-col justify-center gap-2 px-6 pb-9 pt-11 lg:gap-3 lg:py-16 lg:pl-16 lg:pr-14">
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

        <div className="relative flex flex-col justify-between gap-7 px-6 pb-9 pt-7 transition-[translate,rotate] duration-500 ease-[var(--ease-snap)] lg:w-[380px] lg:origin-left lg:py-14 lg:pl-10 lg:pr-12 lg:group-hover:translate-x-1.5 lg:group-hover:rotate-1">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 font-fragment text-[13px]">
              <span className="tracking-[2px]">ADMIT ONE</span>
              <span className="tracking-[1px] text-sb-paper/65">Nº 0001 — QUEENS</span>
            </div>
            <p className="font-geist text-[17px] leading-[27px] text-sb-paper/85">The application helps us learn about you, your work, and how you would like to participate in the community.</p>
          </div>
          <Link to="/join" className={cn(pill, "w-fit gap-2.5 bg-sb-paper px-[26px] py-4 text-sm text-sb-blue focus-visible:ring-sb-paper focus-visible:ring-offset-transparent")}>
            Start your application <Icon name="arrow" className="sb-arrow size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="flex scroll-mt-20 flex-col gap-9 px-4 pb-20 pt-16 lg:flex-row lg:gap-24 lg:px-16 lg:pb-32 lg:pt-[104px]">
      <div className="flex flex-col gap-2.5 lg:w-[380px] lg:shrink-0 lg:gap-3.5">
        <span className="font-display text-sm uppercase tracking-[1.6px] text-sb-muted">A collective for Queens</span>
        <span className="font-script text-4xl text-sb-blue lg:text-[44px]">come as you are</span>
        <h2 id="faq-title" className="font-display text-[42px] leading-[1.03] tracking-[-1px] lg:text-[64px]">Questions, answered.</h2>
        <div className="flex flex-col gap-[18px] pt-3.5">
          <p className="font-geist text-base leading-[26px] text-sb-muted">Still wondering about something? Send us a note — a real person in Queens reads every one.</p>
          <Link to="/join" className="group inline-flex w-fit items-center gap-2.5 font-display text-sm uppercase tracking-[1.6px] text-sb-blue outline-none focus-visible:underline">
            <span className="sb-link">Ask us anything</span> <Icon name="arrow" className="size-4 transition-[translate] duration-300 group-hover:translate-x-[3px]" />
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {FAQ.map((item, i) => (
          <details key={item.q} name="faq" open={i === 0} className="sb-faq group rounded-md border-b border-sb-ink/15 transition-[background-color,border-color] duration-500 open:border-transparent open:bg-sb-mint">
            <summary className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-sb-blue lg:gap-5 lg:px-8 lg:py-[26px]">
              <span className="w-[22px] shrink-0 font-fragment text-xs text-sb-muted group-open:text-sb-ink lg:w-7 lg:text-[13px]">0{i + 1}</span>
              <span className="flex-1 font-display text-[19px] leading-[23px] transition-[translate] duration-300 group-hover:translate-x-1 lg:text-[26px] lg:leading-tight">{item.q}</span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sb-paper sb-toggle ring-1 ring-sb-ink/25 group-open:bg-sb-ink group-open:text-sb-paper group-open:ring-0 lg:size-11">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden className="size-[18px]">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" className="origin-center transition-[scale] duration-300 group-open:scale-y-0" />
                </svg>
              </span>
            </summary>
            <p className="pb-7 pl-[50px] pr-4 font-geist text-[15px] leading-6 lg:pb-9 lg:pl-20 lg:pr-24 lg:text-[17px] lg:leading-[27px]">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SiteFooter() {
  const links = [
    { label: "Our mission", href: "#mission" },
    { label: "Members", to: "/members" as const },
    { label: "Join", to: "/join" as const },
    { label: "Sign in", to: "/account" as const },
  ];
  return (
    <footer className="flex flex-col gap-7 rounded-t-[36px] bg-sb-lilac px-5 pb-7 pt-12 lg:gap-10 lg:px-16 lg:pb-9 lg:pt-[72px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="font-script text-[26px] leading-[29px] lg:text-[34px] lg:leading-normal">find your people, share what you do &amp; help someone else shine</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4 lg:gap-7">
          {links.map((l) => l.to
            ? <Link key={l.label} to={l.to} className={cn(navLink, "text-[13px]")}>{l.label}</Link>
            : <a key={l.label} href={l.href} className={cn(navLink, "text-[13px]")}>{l.label}</a>)}
        </nav>
      </div>
      <p aria-hidden className="motion-scroll-reveal font-display text-[clamp(3.25rem,9vw,8.125rem)] leading-none tracking-[-0.03em]">The Women’s Collective</p>
      <div className="flex flex-col gap-2.5 border-t border-sb-ink/20 pb-1 pt-4 font-geist text-[13px] sm:flex-row sm:justify-between lg:pt-5">
        <span>The Women’s Collective · Western Queens</span>
        <div className="flex gap-6">
          <a href="/privacy" className="sb-link">Privacy</a>
          <a href="/terms" className="sb-link">Terms</a>
          <a href="/code-of-conduct" className="sb-link">Code of conduct</a>
        </div>
      </div>
    </footer>
  );
}
