import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ConstellationLogo, cn } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Scallop } from "@/app/layout/twc";
import { fetchNeighborhoods, type Neighborhood } from "@/features/neighborhoods/queries";
import { hasColor, textOn } from "@/features/neighborhoods/tone";
import { HoodLogo } from "@/features/neighborhoods/HoodLogo";

const TITLE = "Neighborhoods — The Women’s Collective";
const DESCRIPTION = "Each Western Queens neighborhood in The Women’s Collective has its own identity and color. Find yours and meet the women nearby.";

export const Route = createFileRoute("/neighborhoods")({
  // Active ones only, in the admin's sort order: a neighborhood added in admin shows up here without code.
  loader: async ({ context }) => (await fetchNeighborhoods(context.queryClient)).filter((n) => n.active),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NeighborhoodsPage,
});

const WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

/** The headline counts what is live, never a hard-coded number. */
function headline(count: number) {
  if (count === 0) return "Our neighborhoods, one constellation.";
  return `${WORDS[count] ?? count} neighborhood${count === 1 ? "" : "s"}, one constellation.`;
}

function NeighborhoodsPage() {
  const hoods = Route.useLoaderData();
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Scallop from="#fcfcfa" to="#edd22e" />
        <section className="twc-band twc-band--sun pb-24 pt-16">
          <div className="twc-wrap flex max-w-[860px] flex-col items-center gap-[18px] text-center">
            <span className="grid size-[110px] place-items-center rounded-full bg-sb-paper p-6">
              <ConstellationLogo alt="" className="size-full" />
            </span>
            <p className="twc-eyebrow-script text-sb-ink">our constellation</p>
            <h1 className="twc-display">{headline(hoods.length)}</h1>
            <p className="max-w-[620px] text-[17px] leading-[1.65]">
              Each neighborhood has its own identity and color. The central star is the point where those neighborhoods and connections meet.
            </p>
          </div>
        </section>
        <Scallop from="#edd22e" to="#fcfcfa" />

        <section aria-label="All neighborhoods" className="twc-wrap flex flex-col gap-6 pb-[88px] pt-[72px]">
          {hoods.length > 0 && (
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
              {hoods.map((hood, i) => <li key={hood.slug}><Tile hood={hood} index={i + 1} /></li>)}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[6px] px-6 py-[22px] shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)]">
            <span className="twc-chip twc-chip--ring">Nearby</span>
            <span className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
              <span className="font-display text-2xl leading-[1.3]">Another Queens neighborhood?</span>
              <span className="text-[15px] text-sb-muted">
                Woodside, East Elmhurst and nearby neighbors belong here too.{" "}
                <Link to="/join" className="twc-inlink">Introduce yourself</Link>
              </span>
            </span>
          </div>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}

function Tile({ hood, index }: { hood: Neighborhood; index: number }) {
  const colored = hasColor(hood.color);
  // Only large text (3:1, reached on any color) and the aria-hidden ordinal sit on the color; the list conveys order.
  const onPaper = colored && textOn(hood.color).text === "paper";
  return (
    <Link
      to="/neighborhoods/$slug"
      params={{ slug: hood.slug }}
      style={colored ? ({ "--hood": hood.color } as React.CSSProperties) : undefined}
      className={cn(
        "flex min-h-[168px] flex-col sm:min-h-[260px] justify-between gap-6 rounded-[6px] p-6 transition-[translate] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-sb-blue-ink motion-reduce:transform-none",
        colored ? "bg-(--hood)" : "border-[1.5px] border-dashed border-sb-ink/35 bg-sb-cream",
        onPaper ? "text-sb-paper hover:text-sb-paper" : "text-sb-ink hover:text-sb-ink",
      )}
    >
      <span className="flex items-start justify-between">
        <span aria-hidden className="font-fragment text-[13px] leading-[19.5px] tracking-[1px]">{String(index).padStart(2, "0")}</span>
        <HoodLogo hood={hood} className="size-11" />
      </span>
      <span className="font-display text-[34px] leading-[1.1] tracking-[-0.3px]">{hood.name}</span>
    </Link>
  );
}
