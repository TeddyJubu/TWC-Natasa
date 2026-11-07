// The live site's page chrome. Showcase pages use `@/showcase/Shell` instead; nothing here may import from it.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { BrandLockup, Footer, Navbar, type FooterProps, type NavbarProps, type RouterLinkComponent } from "@/index";

export function AppPage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas text-ink">{children}</div>;
}

/** Design-system links in, TanStack `Link` out: "/path#hash" becomes `to="/path"` + `hash="hash"`. */
// ponytail: no "?query" support (no nav/footer href has one); split it into `search` when one does.
const RouterLink: RouterLinkComponent = ({ href, className, children, onClick }) => {
  const at = href.indexOf("#");
  const to = at === -1 ? href : href.slice(0, at) || "/";
  const hash = at === -1 ? undefined : href.slice(at + 1);
  return <Link to={to} hash={hash} className={className} onClick={onClick}>{children}</Link>;
};

export type AppNavProps = Omit<NavbarProps, "brand"> & { brand?: React.ReactNode };

/** Site navbar; the brand defaults to the compact lockup linking home (white on the hero). */
export function AppNav({ brand, variant, ...props }: AppNavProps) {
  return (
    <Navbar
      variant={variant}
      brand={brand ?? (
        <Link to="/" className="transition-opacity hover:opacity-70" aria-label="The Women’s Collective home">
          <BrandLockup compact logoVariant={variant === "hero" ? "white" : undefined} />
        </Link>
      )}
      linkComponent={RouterLink}
      {...props}
    />
  );
}

/** Site footer with the shared brand, statement and note; pages pass their own links. */
export function AppFooter(props: Omit<FooterProps, "brand" | "statement" | "note">) {
  return (
    <Footer
      brand={<BrandLockup logoVariant="white" />}
      statement="Find your people, share what you do, and help someone else shine."
      note="The Women’s Collective · Western Queens"
      linkComponent={RouterLink}
      {...props}
    />
  );
}
