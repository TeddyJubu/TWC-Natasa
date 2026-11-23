// The live site's page chrome (the scrapbook kit: src/app/twc.css). Showcase pages use `@/showcase/Shell`
// instead; nothing here may import from it.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, ImageTrail, cn } from "@/index";
import { viewerQuery } from "@/features/members/queries";
import { Icon } from "./twc";

/**
 * Live page wrapper. Its first child is a "Skip to content" link to `#main`: every page puts its content
 * between the nav and the footer in one `<main id="main" tabIndex={-1} className="outline-none">`.
 * It also hosts the glitter cursor trail (client-only, fine pointers, no reduced motion), except on the internal
 * pages, which pass `trail={false}`.
 */
export function AppPage({ children, className, trail = true }: { children: React.ReactNode; className?: string; trail?: boolean }) {
  return (
    <div className={cn("twc-page min-h-screen overflow-x-clip", className)}>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-sb-ink px-5 py-3 text-sb-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-sb-blue-ink focus:ring-offset-2"
      >
        Skip to content
      </a>
      {children}
      {trail && <ImageTrail />}
    </div>
  );
}

export type SiteLink = { label: string; to: "/about" | "/members" | "/events" | "/neighborhoods" | "/faq" | "/fellowship" | "/partnerships" | "/contact" | "/join" | "/account" };

const NAV_START: SiteLink[] = [
  { label: "About", to: "/about" },
  { label: "Members", to: "/members" },
  { label: "Events", to: "/events" },
];
const NAV_END: SiteLink[] = [
  { label: "Neighborhoods", to: "/neighborhoods" },
  { label: "FAQ", to: "/faq" },
];
const MENU: SiteLink[] = [...NAV_START, ...NAV_END, { label: "Contact", to: "/contact" }, { label: "Sign in", to: "/account" }];

// The menu and its dialog code load on first use, so a public page never pays for them up front.
const loadSiteMenu = () => import("./SiteMenu");
const SiteMenu = React.lazy(loadSiteMenu);

const navLink = "twc-link whitespace-nowrap font-display text-[15px] tracking-[0.3px] text-sb-ink";

/** Sticky site header: three links, the logo, two links + Sign in + Join us; a full-screen Dialog menu below lg.
 *  At lg the row is measured at ~845px (Gilda at 15px, the 18px wordmark, 20px link gaps, 16px column gaps) in the
 *  896px `.twc-wrap` leaves at 1024px; the right group is the wider one, so the logo sits up to ~38px left of centre
 *  until ~1100px, then centred. xl widens the gaps and the wordmark into the wrap's 1024px. */
export function AppNav({ bare = false }: { bare?: boolean }) {
  // ponytail: pre-launch, the form pages (and sign-in, where /join leads) show only the name, so nobody browses the
  // unpublished site from them. Drop `bare` from the form routes at launch.
  if (bare) {
    return (
      <header className="sticky top-0 z-40 bg-sb-paper/85 backdrop-blur-md">
        <div className="flex min-h-16 items-center justify-center gap-2.5 px-4 text-sb-ink lg:min-h-[88px]">
          <ConstellationLogo variant="ink" alt="" sizes="(min-width: 80rem) 34px, 28px" className="w-7 xl:w-[34px]" />
          <span className="whitespace-nowrap font-display text-[15px] sm:text-base lg:text-[18px] xl:text-[22px]">The Women’s Collective</span>
        </div>
      </header>
    );
  }
  return <SiteNav />;
}

/** The full nav. Bare pages never mount it, so they never ask who is looking (the PIN leaves that function shut). */
function SiteNav() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuMounted, setMenuMounted] = React.useState(false);
  // Known only in the browser: the server's HTML and first paint are the signed-out nav, so hydration always matches.
  const signedIn = useQuery({ ...viewerQuery, staleTime: 60_000 }).data?.signedIn === true;
  const brand = (
    <Link to="/" activeOptions={{ exact: true }} className="group flex items-center gap-2.5 text-sb-ink outline-none focus-visible:text-sb-blue-ink" aria-label="The Women’s Collective home">
      <ConstellationLogo variant="ink" alt="" sizes="(min-width: 80rem) 34px, 28px" className="w-7 transition-[rotate] duration-500 ease-[var(--ease-snap)] group-hover:rotate-[24deg] motion-reduce:transition-none xl:w-[34px]" />
      <span className="whitespace-nowrap font-display text-[15px] max-[359px]:sr-only sm:text-base lg:text-[18px] xl:text-[22px]">The Women’s Collective</span>
    </Link>
  );
  const join = (size: string) => (
    <Link to={signedIn ? "/account" : "/join"} className={cn("twc-btn twc-btn--blue twc-btn--sm", size)}>{signedIn ? "Account" : "Join us"}</Link>
  );
  return (
    <header className="sticky top-0 z-40 bg-sb-paper/85 backdrop-blur-md">
      <div className="twc-wrap hidden min-h-[88px] grid-cols-[1fr_auto_1fr] items-center gap-4 lg:grid xl:gap-6">
        <nav aria-label="Main" className="flex items-center gap-5 xl:gap-9">
          {NAV_START.map((l) => <Link key={l.to} to={l.to} className={navLink}>{l.label}</Link>)}
        </nav>
        {brand}
        <div className="flex items-center justify-end gap-5 xl:gap-9">
          {NAV_END.map((l) => <Link key={l.to} to={l.to} className={navLink}>{l.label}</Link>)}
          {!signedIn && <Link to="/account" className={navLink}>Sign in</Link>}
          {join("")}
        </div>
      </div>

      <div className="flex min-h-16 items-center justify-between gap-3 px-4 lg:hidden">
        {brand}
        <div className="-mr-2 flex items-center gap-1">
          {join("min-h-9 px-3.5 py-2 text-[11px] tracking-[1.2px]")}
          <button
            type="button" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menuOpen}
            onPointerEnter={() => void loadSiteMenu()} onFocus={() => void loadSiteMenu()}
            onClick={() => { setMenuMounted(true); setMenuOpen(true); }}
            className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sb-blue-ink"
          >
            <Icon name="menu" className="size-[22px]" />
          </button>
        </div>
      </div>

      {menuMounted && (
        <React.Suspense fallback={null}>
          <SiteMenu open={menuOpen} onOpenChange={setMenuOpen} links={MENU.filter((l) => !signedIn || l.to !== "/account")} signedIn={signedIn} />
        </React.Suspense>
      )}
    </header>
  );
}

const FOOTER: SiteLink[] = [
  { label: "About", to: "/about" },
  { label: "Members", to: "/members" },
  { label: "Events", to: "/events" },
  { label: "Neighborhoods", to: "/neighborhoods" },
  { label: "FAQ", to: "/faq" },
  { label: "Fellowship", to: "/fellowship" },
  { label: "Partnerships", to: "/partnerships" },
  { label: "Join", to: "/join" },
  { label: "Contact", to: "/contact" },
  { label: "Sign in", to: "/account" },
];
/** Lilac site footer: tagline + site links, the big wordmark and the collective's name. No legal links until the
 *  pages exist again (docs/LEGAL-PAGES-REQUIRED.md). */
export function AppFooter({ bare = false }: { bare?: boolean }) {
  return (
    <footer className="twc-footer">
      <div className="twc-wrap">
        <div className="twc-footer__top">
          <p className="twc-footer__tag">find your people, share what you do &amp; help someone else shine</p>
          {!bare && (
            <nav aria-label="Footer" className="twc-footer__links">
              {FOOTER.map((l) => <Link key={l.to} to={l.to} className="twc-link">{l.label}</Link>)}
            </nav>
          )}
        </div>
        <p aria-hidden className="twc-footer__word">The Women’s Collective</p>
        <div className="twc-footer__legal">
          <span>The Women’s Collective · North Brooklyn and Queens</span>
        </div>
      </div>
    </footer>
  );
}
