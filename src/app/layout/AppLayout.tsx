// The live site's page chrome. Showcase pages use `@/showcase/Shell` instead; nothing here may import from it.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { BrandLockup, Footer, Navbar, type FooterProps, type NavbarProps } from "@/index";

export function AppPage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas text-ink">{children}</div>;
}

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
      {...props}
    />
  );
}
