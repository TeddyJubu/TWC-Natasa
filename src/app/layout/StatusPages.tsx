// The live site's 404 and error pages, wired as the router defaults in `src/router.tsx`.
import * as React from "react";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { ConstellationLogo } from "@/index";
import { AppFooter, AppNav, AppPage } from "./AppLayout";
import { Icon } from "./twc";

const QUICK = [
  { label: "Events", to: "/events" },
  { label: "Join", to: "/join" },
  { label: "Sign in", to: "/account" },
] as const;

/** The canvas page head on its own: an eyebrow, the h1, a message and the actions, with the mark at the side.
 *  `tilt` is kept for the form pages that still pass it; the canvas head has no tilt. */
export function StatusPage({ script, title, intro, children, bare }: {
  script: string; tilt?: string; title: string; intro: string; children?: React.ReactNode; bare?: boolean;
}) {
  return (
    <AppPage>
      <AppNav bare={bare} />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="status-title" className="twc-status">
          <div className="min-w-0">
            <p className="twc-eyebrow mb-3.5">{script}</p>
            <h1 id="status-title" className="twc-display">{title}</h1>
            <p className="twc-lede mt-4.5">{intro}</p>
            {children && <div className="twc-status__acts">{children}</div>}
          </div>
          <ConstellationLogo alt="" sizes="96px" className="twc-phd__mark" />
        </section>
      </main>
      <AppFooter bare={bare} />
    </AppPage>
  );
}

export function NotFound() {
  return (
    <StatusPage
      script="page not found"
      title="We couldn’t find that page."
      intro="The link may be old, or the page may have moved. Head home and find your people from there."
    >
      <Link to="/" className="twc-btn">Back to home <Icon name="arrow" className="twc-arrow" /></Link>
      <nav aria-label="Try instead" className="flex flex-wrap gap-x-2 text-sm text-sb-muted">
        {QUICK.map((l, i) => (
          <React.Fragment key={l.to}>
            {i > 0 && <span aria-hidden>·</span>}
            <Link to={l.to} className="twc-inlink">{l.label}</Link>
          </React.Fragment>
        ))}
      </nav>
    </StatusPage>
  );
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  React.useEffect(() => {
    console.error("[route] render failed", error);
  }, [error]);
  return (
    <StatusPage
      script="something went wrong"
      title="That page didn’t load."
      intro="Something on our side tripped up. Try again, or head home and pick up from there."
    >
      <>
        <button
          type="button"
          className="twc-btn"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again <Icon name="arrow" className="twc-arrow" />
        </button>
        <Link to="/" className="twc-btn twc-btn--outline">Back to home</Link>
      </>
    </StatusPage>
  );
}
