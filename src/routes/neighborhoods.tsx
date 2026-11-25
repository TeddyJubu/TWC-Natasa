import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ConstellationLogo, cn } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { fetchNeighborhoods, type Neighborhood } from "@/features/neighborhoods/queries";
import { hasColor, textOn } from "@/features/neighborhoods/tone";
import { HoodLogo } from "@/features/neighborhoods/HoodLogo";
import { areaOfPlace } from "@/features/applications/schema";

const TITLE = "Neighborhoods — The Women’s Collective";
const DESCRIPTION = "Each North Brooklyn and Queens neighborhood in The Women’s Collective has its own identity and color. Find yours and meet the women nearby.";

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
        <section className="twc-phd">
          <div className="min-w-0">
            <p className="twc-eyebrow">Our constellation</p>
            <h1 className="twc-display">{headline(hoods.length)}</h1>
            <p className="twc-lede">
              Each neighborhood has its own identity and color. The central star is the point where those neighborhoods and connections meet.
            </p>
          </div>
          <ConstellationLogo alt="" sizes="96px" className="twc-phd__mark" />
        </section>

        <section aria-label="All neighborhoods">
          {hoods.length > 0 && (
            <ul className="twc-hbands">
              {hoods.map((hood, i) => <li key={hood.slug}><Band hood={hood} index={i + 1} /></li>)}
            </ul>
          )}
          <div className="twc-sec twc-sec--tight flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="twc-flag">Nearby</span>
            <span className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
              <span className="font-display text-[28px] font-extrabold leading-none [font-stretch:75%]">Another neighborhood?</span>
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

/** A constellation band (canvas .twc-band) that links to the neighborhood: number, name, area and mark. */
function Band({ hood, index }: { hood: Neighborhood; index: number }) {
  const colored = hasColor(hood.color);
  // The name is large text (3:1, reached on any color); the small number and area sit on paper tags.
  const onPaper = colored && textOn(hood.color).text === "paper";
  const area = areaOfPlace(hood.name);
  return (
    <Link
      to="/neighborhoods/$slug"
      params={{ slug: hood.slug }}
      style={colored ? ({ "--hood": hood.color } as React.CSSProperties) : undefined}
      className={cn(
        "twc-hband",
        colored ? "bg-(--hood)" : "border-[1.5px] border-dashed border-sb-ink/35 bg-sb-cream",
        onPaper ? "text-sb-paper hover:text-sb-paper" : "text-sb-ink hover:text-sb-ink",
      )}
    >
      <span aria-hidden className="twc-hband__tag bg-sb-paper text-sb-ink">{String(index).padStart(2, "0")}</span>
      <span className="twc-hband__name">{hood.name}</span>
      <span className="twc-hband__end">
        {area && <span className="twc-hband__tag max-[1100px]:hidden">{area.name}</span>}
        <HoodLogo hood={hood} sizes="28px" className="size-11" />
      </span>
    </Link>
  );
}
