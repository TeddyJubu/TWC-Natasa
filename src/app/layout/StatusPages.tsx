// The live site's 404 and error pages, wired as the router defaults in `src/router.tsx`.
import * as React from "react";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { ConstellationLogo, cn } from "@/index";
import { AppFooter, AppNav, AppPage } from "./AppLayout";
import { Icon, Scallop } from "./twc";

const QUICK = [
  { label: "Members", to: "/members" },
  { label: "Join", to: "/join" },
  { label: "Sign in", to: "/account" },
] as const;

/** One centred card on a cream band: logo, Caveat line, h1, message, actions. */
export function StatusPage({ script, tilt, title, intro, children }: {
  script: string; tilt: string; title: string; intro: string; children: React.ReactNode;
}) {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Scallop from="#fcfcfa" to="#f3f0e8" />
        <div className="twc-band twc-band--cream pb-24 pt-16">
          <div className="twc-wrap flex justify-center">
            <section aria-labelledby="status-title" className="flex w-full max-w-[520px] flex-col items-center gap-4 rounded-md bg-sb-paper px-5 py-8 text-center shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] md:px-10 md:py-12">
              <ConstellationLogo alt="" sizes="96px" className="w-24" />
              <p aria-hidden className={cn("font-script text-5xl leading-none text-sb-blue md:text-[64px]", tilt)}>{script}</p>
              <h1 id="status-title" className="text-balance font-display text-[34px] leading-[1.08] tracking-[-0.5px] md:text-[44px]">{title}</h1>
              <p className="max-w-[40ch] text-sb-muted">{intro}</p>
              {children}
            </section>
          </div>
        </div>
        <Scallop from="#f3f0e8" to="#fcfcfa" />
        <div className="h-12" />
      </main>
      <AppFooter />
    </AppPage>
  );
}

export function NotFound() {
  return (
    <StatusPage
      script="page not found"
      tilt="-rotate-3"
      title="We couldn’t find that page."
      intro="The link may be old, or the page may have moved. Head home and find your people from there."
    >
      <Link to="/" className="twc-btn mt-2">Back to home <Icon name="arrow" className="twc-arrow" /></Link>
      <nav aria-label="Try instead" className="mt-2 flex flex-wrap justify-center gap-x-2 text-sm text-sb-muted">
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
      tilt="rotate-2"
      title="That page didn’t load."
      intro="Something on our side tripped up. Try again, or head home and pick up from there."
    >
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
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
      </div>
    </StatusPage>
  );
}
