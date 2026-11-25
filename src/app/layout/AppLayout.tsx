// The live site's page chrome (the scrapbook kit: src/app/twc.css). Showcase pages use `@/showcase/Shell`
// instead; nothing here may import from it.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageTrail, LOCKUP, cn } from "@/index";
import { viewerQuery } from "@/features/members/queries";
import { Icon, JOIN_CLASS, JoinButton } from "./twc";

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

export type SiteLink = { label: string; to: "/about" | "/directory" | "/events" | "/neighborhoods" | "/faq" | "/fellowship" | "/partnerships" | "/contact" | "/join" | "/account" };

const NAV_START: SiteLink[] = [
  { label: "About", to: "/about" },
  { label: "Events", to: "/events" },
  { label: "Neighborhoods", to: "/neighborhoods" },
];
// The member directory is members-only (owner decision, 2026-11-24): its link shows only to approved members and admins.
const DIRECTORY: SiteLink = { label: "Directory", to: "/directory" };
const FAQ: SiteLink = { label: "FAQ", to: "/faq" };
const navEnd = (member: boolean): SiteLink[] => (member ? [DIRECTORY, FAQ] : [FAQ]);

// The menu and its dialog code load on first use, so a public page never pays for them up front.
const loadSiteMenu = () => import("./SiteMenu");
const SiteMenu = React.lazy(loadSiteMenu);

const navLink = "twc-link whitespace-nowrap text-[14px] text-sb-ink";

/** The wordmark lockup (three stars and the name), drawn as an image; its text is the link's or the page's. */
function Lockup({ className }: { className?: string }) {
  return <img src={LOCKUP.src} width={LOCKUP.width} height={LOCKUP.height} alt="" className={cn("block w-auto", className)} />;
}

/** Sticky site header, the canvas's Programme layout: the lockup on the left; About, Events, Neighborhoods, FAQ, Sign in
 *  and Join us on the right (members: Directory, FAQ and Account); a full-screen Dialog menu below lg. */
export function AppNav({ bare = false }: { bare?: boolean }) {
  // ponytail: pre-launch, the form pages (and sign-in, where /join leads) show only the name, so nobody browses the
  // unpublished site from them. Drop `bare` from the form routes at launch.
  if (bare) {
    return (
      <header className="sticky top-0 z-40 bg-sb-paper">
        <div className="flex min-h-16 items-center justify-center px-4 py-3 text-sb-ink lg:min-h-[88px]">
          <Lockup className="h-10 lg:h-[61px]" />
          <span className="sr-only">The Women’s Collective</span>
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
  const viewer = useQuery({ ...viewerQuery, staleTime: 60_000 }).data;
  const signedIn = viewer?.signedIn === true;
  const member = viewer?.member === true || viewer?.admin === true;
  const end = navEnd(member);
  const brand = (
    <Link to="/" activeOptions={{ exact: true }} className="block shrink-0 rounded-sm text-sb-ink" aria-label="The Women’s Collective home">
      <Lockup className="h-10 lg:h-[61px] xl:h-[81px]" />
    </Link>
  );
  const join = (size: string) => signedIn
    ? <Link to="/account" className={cn(JOIN_CLASS, "twc-btn--sm", size)}>Account</Link>
    // The header's compact pill: no arrow and one line, so the lg row and a 360px phone bar still fit.
    : <JoinButton className={cn("twc-btn--sm whitespace-nowrap [&_.twc-arrow]:hidden", size)} />;
  return (
    <header className="sticky top-0 z-40 bg-sb-paper">
      <div className="hidden items-center justify-between gap-6 px-10 pb-4 pt-[18px] lg:flex">
        {brand}
        <nav aria-label="Main" className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {[...NAV_START, ...end].map((l) => <Link key={l.to} to={l.to} className={navLink}>{l.label}</Link>)}
          {!signedIn && <Link to="/account" className={navLink}>Sign in</Link>}
          {join("")}
        </nav>
      </div>

      <div className="flex min-h-16 items-center justify-between gap-3 px-5 py-3 lg:hidden">
        {brand}
        <div className="-mr-2 flex items-center gap-1">
          {join("min-h-9")}
          <button
            type="button" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menuOpen}
            onPointerEnter={() => void loadSiteMenu()} onFocus={() => void loadSiteMenu()}
            onClick={() => { setMenuMounted(true); setMenuOpen(true); }}
            className="grid size-11 place-items-center rounded-full"
          >
            <Icon name="menu" className="size-[22px]" />
          </button>
        </div>
      </div>

      {menuMounted && (
        <React.Suspense fallback={null}>
          <SiteMenu open={menuOpen} onOpenChange={setMenuOpen} links={[...NAV_START, ...end, { label: "Contact", to: "/contact" }, ...(signedIn ? [] : [{ label: "Sign in", to: "/account" } as const])]} signedIn={signedIn} />
        </React.Suspense>
      )}
    </header>
  );
}

const FOOTER: SiteLink[] = [
  { label: "About", to: "/about" },
  { label: "Events", to: "/events" },
  { label: "Neighborhoods", to: "/neighborhoods" },
  { label: "FAQ", to: "/faq" },
  { label: "Fellowship", to: "/fellowship" },
  { label: "Partnerships", to: "/partnerships" },
  { label: "Join", to: "/join" },
  { label: "Contact", to: "/contact" },
  { label: "Sign in", to: "/account" },
];
/** Site footer, the canvas's: a giant "find your people." over Plex Mono columns (the name, the two live
 *  constellations, the site links). No legal links until the pages exist again (docs/LEGAL-PAGES-REQUIRED.md). */
export function AppFooter({ bare = false }: { bare?: boolean }) {
  return (
    <footer className="twc-footer">
      <div className="px-5 lg:px-10">
        <p className="twc-footer__big">find your people.</p>
        <div className="twc-footer__cols">
          <div>
            <p className="twc-footer__wm">The Women’s Collective</p>
            <p className="mt-2">Share what you do &amp; help someone else shine.</p>
          </div>
          <div>
            <p>Constellations</p>
            <p>North Brooklyn · Queens</p>
          </div>
          {!bare && (
            <nav aria-label="Footer" className="col-span-2 max-[1100px]:col-span-1">
              {FOOTER.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
}
