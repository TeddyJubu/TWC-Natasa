// The design canvas's inline headline and experience tiles (docs/design-canvas/, inlineHead() + tiles()): seven ways to
// take part as colour tiles, with film photos between them (12 cells: 6 / 3 / 2 across). Stock photos
// (src/assets/photography/home/CREDITS.md), captioned by kind only: they are not our events.
import { Link } from "@tanstack/react-router";
import xpZoom from "@/assets/photography/home/xp-zoom.webp";
import xpCoffee from "@/assets/photography/home/xp-coffee.webp";
import xpPanel from "@/assets/photography/home/xp-panel.webp";
import xpWorkshop from "@/assets/photography/home/xp-workshop.webp";
import xpEvening from "@/assets/photography/home/xp-evening.webp";

const XP = [
  { k: "Constellation Zooms", h: "A monthly call with your own Constellation to share updates, ask for introductions, and follow up on what you’re working on.", a: ["Included in membership", "Your Constellation"], field: "bg-sb-ev-green" },
  { k: "Coffee Connections", h: "A small neighborhood coffee where there’s time for a real conversation. New dates posted as they’re announced.", a: ["Included in membership", "First visit complimentary for invited guests", "Drinks purchased separately"], field: "bg-sb-ev-mint" },
  { k: "Constellation Meetups", h: "A larger, in-person meetup for each Constellation, with time for introductions and member spotlights.", a: ["Included in membership", "Your Constellation"], field: "bg-sb-ev-peri" },
  { k: "Expert Panels", h: "A focused conversation with two or three women who have firsthand experience with the topic, followed by audience Q&A.", a: ["Ticketed", "Member pricing", "Open to guests"], field: "bg-sb-ev-violet" },
  { k: "Hands-on Workshops", h: "A guided working session where you leave with something you can use, such as a revised pitch or a plan for your next launch.", a: ["Ticketed", "Member pricing", "Guest access by event"], field: "bg-sb-ev-sea" },
  { k: "Incubator Growth Sessions", h: "A small group that meets over several sessions to work through a specific business goal and follow up on progress.", a: ["Members only", "Separate paid program"], field: "bg-sb-cobalt twc-tile--dark" },
  { k: "Happy Hours", h: "An informal evening to meet members in your neighborhood. New dates posted as they’re announced.", a: ["Included in membership", "First visit complimentary for invited guests", "Drinks purchased separately"], field: "bg-sb-sky" },
] as const;
const PHOTOS = {
  zoom: { src: xpZoom, alt: "A woman waving on a video call on a laptop", caption: "Zoom night" },
  coffee: { src: xpCoffee, alt: "Two women talking over coffee at a café table", caption: "Coffee" },
  panel: { src: xpPanel, alt: "A woman speaking into a microphone on a panel", caption: "Expert panel" },
  workshop: { src: xpWorkshop, alt: "Two women drawing at a workshop table", caption: "Workshop" },
  evening: { src: xpEvening, alt: "A hand lighting a candle on a long table", caption: "Happy hour" },
} as const;
type Cell = { tile: number } | { photo: keyof typeof PHOTOS };
const GRID: Cell[] = [
  { tile: 0 }, { photo: "zoom" }, { tile: 1 }, { photo: "coffee" }, { tile: 2 }, { tile: 3 },
  { photo: "panel" }, { tile: 4 }, { photo: "workshop" }, { tile: 5 }, { tile: 6 }, { photo: "evening" },
];
const no = (i: number) => String(i + 1).padStart(2, "0");

/** The headline (`h1` where it opens the page) and the twelve cells. */
export function Experiences({ heading: H = "h2" }: { heading?: "h1" | "h2" }) {
  const T = H === "h1" ? "h2" : "h3"; // the tiles' titles sit one level under the headline
  return (
    <section aria-labelledby="xp-title">
      <H id="xp-title" className="twc-inline">
        Zooms <span aria-hidden className="twc-inline__star">✺</span> Coffee <span aria-hidden className="twc-chipmark twc-chipmark--green" /> Meetups, panels <em>and</em> happy hours <span aria-hidden className="twc-inline__star">✺</span> workshops <em>that move you</em> forward
      </H>
      <div className="twc-grid6">
        {GRID.map((cell) => {
          if ("photo" in cell) {
            const p = PHOTOS[cell.photo];
            return (
              <div key={cell.photo} className="twc-tile twc-tile--photo twc-film">
                <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
                <span>{p.caption}</span>
              </div>
            );
          }
          const x = XP[cell.tile];
          return (
            <Link key={x.k} to="/events" className={`twc-tile ${x.field}`}>
              <div><span className="no">{no(cell.tile)}</span><T>{x.k}</T><p className="h">{x.h}</p></div>
              <p className="p">{x.a.map((line, i) => <span key={line} className="block">{i > 0 && <span className="sr-only"> · </span>}{line}</span>)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
