// The live site's page chrome (the scrapbook kit: src/app/twc.css). Showcase pages use `@/showcase/Shell`
// instead; nothing here may import from it.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageTrail, LOCKUP, cn } from "@/index";
import { viewerQuery } from "@/features/members/queries";
import { JOIN_CLASS, JoinButton } from "./twc";

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

/** `wide`: shown only on wider screens; on a phone the link is still in the footer, so the header stays short. */
export type SiteLink = { label: string; to: "/constellations" | "/directory" | "/events" | "/leadership" | "/membership" | "/partnerships" | "/about" | "/faq" | "/fellowship" | "/contact"; wide?: boolean };

// The canvas's visitor nav, in its order. Directory links to /directory for everyone; that page decides who sees members
// (owner decision, 2026-11-26: no deliberate differences from the canvas).
const NAV: SiteLink[] = [
  { label: "Constellations", to: "/constellations" },
  { label: "Directory", to: "/directory" },
  { label: "Events", to: "/events" },
  { label: "Leadership", to: "/leadership", wide: true },
  { label: "Membership", to: "/membership" },
  { label: "Partner", to: "/partnerships", wide: true },
];

/** The boxed club lockup (stars over the name), drawn as an image; its text is the link's or the page's. */
function Lockup() {
  return <img src={LOCKUP.src} width={LOCKUP.width} height={LOCKUP.height} alt="" className="twc-header__lockup" />;
}

/** The site header, the canvas's `.twc-header` (Programme): the club lockup, then Constellations · Directory · Events ·
 *  Leadership · Membership · Partner, Log in and the small ink Join pill. Sticky above 1100px; below, the links wrap under
 *  the lockup, as the canvas draws it (no menu button). */
export function AppNav({ bare = false }: { bare?: boolean }) {
  // ponytail: pre-launch, the form pages (and sign-in, where /join leads) show only the name, so nobody browses the
  // unpublished site from them. Drop `bare` from the form routes at launch.
  if (bare) {
    return (
      <header className="twc-header twc-header--bare">
        <span className="twc-logo"><Lockup /><span className="sr-only">The Women’s Collective</span></span>
      </header>
    );
  }
  return <SiteNav />;
}

/** The full nav. Bare pages never mount it, so they never ask who is looking (the PIN leaves that function shut). */
function SiteNav() {
  // Known only in the browser: the server's HTML and first paint are the signed-out nav, so hydration always matches.
  const viewer = useQuery({ ...viewerQuery, staleTime: 60_000 }).data;
  const signedIn = viewer?.signedIn === true;
  return (
    <header className="twc-header">
      <Link to="/" activeOptions={{ exact: true }} className="twc-logo" aria-label="The Women’s Collective home"><Lockup /></Link>
      <nav aria-label="Main" className="twc-nav">
        {NAV.map((l) => <Link key={l.to} to={l.to} className={l.wide ? "twc-nav__wide" : undefined}>{l.label}</Link>)}
        {signedIn
          ? <Link to="/account" className={cn(JOIN_CLASS, "twc-btn--sm")}>Account</Link>
          : <><Link to="/auth">Log in</Link><JoinButton className="twc-btn--sm">Join</JoinButton></>}
      </nav>
    </header>
  );
}

// The canvas's "The Collective" column, plus the pages the canvas doesn't draw (About, FAQ, Fellowship, Contact).
const FOOTER: SiteLink[] = [
  { label: "Membership", to: "/membership" },
  { label: "Events", to: "/events" },
  { label: "Leadership", to: "/leadership" },
  { label: "Partner with us", to: "/partnerships" },
  { label: "About", to: "/about" },
  { label: "FAQ", to: "/faq" },
  { label: "Fellowship", to: "/fellowship" },
  { label: "Contact", to: "/contact" },
];
const PHOTOGRAPHERS = "Pavel Danilyuk, Natalia S, Katrin Bolovtsova, cottonbro studio, Henri Mathieu-Saint-Laurent, RDNE Stock project, Rachel Claire, Jimme Deknatel, Sasha Zilov, Antonio López, Alistair Freeman, Phil Evenden, Mateusz Pielech, Bilguun Gantumur, Yan Krukau, Roman Odintsov and Camilo Ospina";

/** Site footer, the canvas's `.twc-footer`: a giant "find your people." over four Plex Mono columns (the serif wordmark,
 *  the five constellations, the Collective's pages, the small print). No legal links until the pages exist again
 *  (docs/LEGAL-PAGES-REQUIRED.md); `bare` drops the links on the pre-launch form pages. */
export function AppFooter({ bare = false }: { bare?: boolean }) {
  return (
    <footer className="twc-footer">
      <p className="twc-footer__big">find your people.</p>
      <div className="twc-footer__cols">
        <div>
          <p className="twc-footer__wm">The Women’s <i>Collective</i></p>
          <p className="mt-2">A local-first network of women in business, one neighborhood at a time.</p>
        </div>
        <div>
          <p>Constellations</p>
          {bare
            ? <p>North Brooklyn · Western Queens · Brownstone Brooklyn · Uptown Manhattan · Downtown Manhattan</p>
            : <p><Link to="/constellations">North Brooklyn · Western Queens · Brownstone Brooklyn · Uptown Manhattan · Downtown Manhattan</Link></p>}
        </div>
        {!bare && (
          <div>
            <p>The Collective</p>
            <nav aria-label="Footer">{FOOTER.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}</nav>
            <p className="mt-2"><a href="mailto:info@thewomenscollective.club">info@thewomenscollective.club</a></p>
          </div>
        )}
        <div>
          <p>Small print</p>
          <details className="twc-footer__credits"><summary>Photo credits</summary><p>Photos from Pexels by {PHOTOGRAPHERS}.</p></details>
          {/* Owner's request, 2026-11-27 */}
          <p className="mt-2">Member headshots are the property of The Women’s Collective and may not be copied or used on any other platform without our written permission.</p>
        </div>
      </div>
    </footer>
  );
}
