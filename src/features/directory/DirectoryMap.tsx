// The directory's map (the canvas's `dirMap`): the five constellations drawn as a planning map of New York — land,
// parks, each neighborhood filled in its constellation's colour (every other one hatched), the streets, the hub
// route, a numbered callout per constellation — and a star for every member it can place. Geography only: the
// shapes, streets and the random spots inside each neighborhood come from the canvas (map-geo.json, streets.json);
// no address, and nobody's position is more precise than her neighborhood. Colours are classes, never style
// attributes. Choosing a constellation zooms to it (an eased viewBox, none under reduced motion); a star opens her card.
import * as React from "react";
import { cn } from "@/index";
import GEO from "./map-geo.json";

export type ConId = "nb" | "wq" | "sb" | "uptown" | "downtown";
/** The five constellations, as the home page names them. */
export const CONSTELLATIONS: { id: ConId; name: string; status: string }[] = [
  { id: "nb", name: "North Brooklyn", status: "Live · Founding 50" },
  { id: "wq", name: "Western Queens", status: "Live" },
  { id: "sb", name: "Brownstone Brooklyn", status: "Launching" },
  { id: "uptown", name: "Uptown Manhattan", status: "Ambassador wanted" },
  { id: "downtown", name: "Downtown Manhattan", status: "Ambassador wanted" },
];
export const conName = (id: ConId) => CONSTELLATIONS.find((c) => c.id === id)!.name;

/** A member the map may show: placed at one of her neighborhood's spots, never at an address. */
export type MapPin = { key: string; name: string; hood: string; con: ConId; caption: string };

type Hood = { d: string; c: [number, number]; fill?: boolean };
type Con = { d: string; bb: [number, number, number, number]; c: [number, number]; hoods: Record<string, Hood> };
const geo = GEO as unknown as { vb: [number, number]; land: string; nj: string; parks: string; con: Record<ConId, Con>; spots: Record<string, [number, number][]> };
const [VW, VH] = geo.vb;
const ORDER: ConId[] = ["uptown", "wq", "nb", "sb", "downtown"];
/** Where each callout box sits (a negative x anchors it to the right edge). */
const CALLOUT: Record<ConId, [number, number]> = { uptown: [14, 26], wq: [-6, 26], downtown: [6, 262], nb: [-6, 588], sb: [10, 676] };
const HUB_AT: Partial<Record<ConId, [number, number]>> = { nb: [276.7, 388.1] };
const HUB_HOOD: Partial<Record<ConId, string>> = { wq: "Sunnyside" };
const SOLID: ConId[] = ["downtown", "uptown"];
const hubOf = (id: ConId): [number, number] => HUB_AT[id] ?? geo.con[id].hoods[HUB_HOOD[id] ?? ""]?.c ?? geo.con[id].c;
/** The neighborhood a name belongs to on the map, if the map draws it. */
export function conOfHood(hood: string): ConId | undefined {
  return (Object.keys(geo.con) as ConId[]).find((id) => hood in geo.con[id].hoods);
}

/** The canvas's four-pointed sparkle, centred on x,y. */
function sparkPath(x: number, y: number, r: number) {
  const k = r * 0.16, f = (v: number) => v.toFixed(1);
  return `M${x} ${f(y - r)}Q${f(x + k)} ${f(y - k)} ${f(x + r)} ${y}Q${f(x + k)} ${f(y + k)} ${x} ${f(y + r)}Q${f(x - k)} ${f(y + k)} ${f(x - r)} ${y}Q${f(x - k)} ${f(y - k)} ${x} ${f(y - r)}Z`;
}

function viewBoxFor(con: ConId | "all"): number[] {
  if (con === "all") return [0, 0, VW, VH];
  const [x, y, w, h] = geo.con[con].bb, pad = Math.max(w, h) * 0.16, ar = VW / VH;
  let W = w + pad * 2, H = h + pad * 2;
  if (W / H > ar) H = W / ar; else W = H * ar;
  return [x + w / 2 - W / 2, y + h / 2 - H / 2, W, H];
}

type Streets = { minor: string; ave: string; hwy: string; bridge: string };

export function DirectoryMap({ pins, con, onCon, onPin }: {
  pins: MapPin[]; con: ConId | "all"; onCon: (con: ConId | "all") => void; onPin: (key: string) => void;
}) {
  const target = viewBoxFor(con);
  const [vb, setVb] = React.useState(target);
  const shown = React.useRef(vb);
  shown.current = vb;
  const [streets, setStreets] = React.useState<Streets | null>(null);
  // The streets are 300 KB of paths: fetched once the map is on screen, never in the page's own chunk.
  React.useEffect(() => { void import("./streets.json").then((m) => setStreets(m.default as Streets)).catch(() => {}); }, []);
  const key = target.join(",");
  React.useEffect(() => {
    const to = key.split(",").map(Number);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof requestAnimationFrame !== "function") { setVb(to); return; }
    const from = shown.current;
    const t0 = performance.now(), D = 520, ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D), e = ease(t);
      setVb(from.map((f, i) => f + (to[i] - f) * e));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key]);

  const z = target[2] / VW, zoomed = con !== "all", f = (v: number) => (v * z).toFixed(2);
  const press = (fn: () => void) => ({
    onClick: fn,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } },
  });

  // Each neighborhood's spots are handed out in order, so two members never share one until the list runs out.
  const used: Record<string, number> = {};
  const stars = pins.flatMap((p) => {
    const spots = geo.spots[p.hood];
    if (!spots) return [];
    const slot = (used[p.hood] = (used[p.hood] ?? 0) + 1) - 1;
    const [x, y] = spots[slot % spots.length];
    return [(
      <g key={p.key} className={cn("mk", `mk--${p.con}`)} tabIndex={0} role="button" aria-label={`${p.name}, ${p.hood}`} {...press(() => onPin(p.key))}>
        <circle cx={x} cy={y} r={f(13)} className="mk-hit" />
        <path d={sparkPath(x, y, 7 * z)} className="mstar" strokeWidth={f(1.3)} />
        <title>{`${p.name}${p.caption ? ` · ${p.caption}` : ""} (${p.hood})`}</title>
      </g>
    )];
  });

  const route = (() => {
    const o = ORDER.map(hubOf);
    let d = `M${o[0][0]} ${o[0][1]}`;
    for (let i = 1; i <= o.length; i++) {
      const a = o[i - 1], b = o[i % o.length];
      d += `Q${((a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.18).toFixed(1)} ${((a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.18).toFixed(1)} ${b[0]} ${b[1]}`;
    }
    return d;
  })();

  return (
    <figure className="dmap-wrap">
      <div className="dmap-box">
        <svg viewBox={vb.map((v) => v.toFixed(1)).join(" ")} role="img" aria-label="Planning-style map of the five constellations with member stars" className="dmap">
          <defs>
            {(Object.keys(geo.con) as ConId[]).map((id) => (
              <pattern key={id} id={`h-${id}`} patternUnits="userSpaceOnUse" width={f(6)} height={f(6)} patternTransform="rotate(45)">
                <rect width={f(6)} height={f(6)} className={`mz-fill--${id}`} /><rect width={f(2.2)} height={f(6)} className={`mz-hatch--${id}`} />
              </pattern>
            ))}
            <pattern id="h-park" patternUnits="userSpaceOnUse" width={f(9)} height={f(9)}>
              <rect width={f(9)} height={f(9)} className="mpark-fill" />
              <path d={`M${f(2)} ${f(2)}l${f(5)} ${f(5)}M${f(7)} ${f(2)}l${f(-5)} ${f(5)}`} className="mpark-x" strokeWidth={f(0.8)} />
            </pattern>
          </defs>
          <rect x={-300} y={-300} width={VW + 600} height={VH + 600} className="mwater" />
          <path d={geo.nj} className="mland mnj" /><path d={geo.land} className="mland" />
          <path d={geo.parks} fill="url(#h-park)" className="mpark" />
          <g>
            {(Object.entries(geo.con) as [ConId, Con][]).map(([id, c]) => (
              <g key={id} className={cn("mcon", con === id && "is-on")} tabIndex={0} role="button" aria-label={`Show members in ${conName(id)}`}
                {...press(() => onCon(con === id ? "all" : id))}>
                {Object.values(c.hoods).map((h, i) => (
                  <path key={i} d={h.d} className={cn("mz", i % 2 && !SOLID.includes(id) ? undefined : `mz-fill--${id}`)} fill={i % 2 && !SOLID.includes(id) ? `url(#h-${id})` : undefined} />
                ))}
                <path d={c.d} className="mo" /><title>{conName(id)}</title>
              </g>
            ))}
          </g>
          {streets && (
            <g transform="scale(.25)" className="mstreets">
              <path className="ms-minor" d={streets.minor} /><path className="ms-ave" d={streets.ave} />
              <path className="ms-hwy-c" d={streets.hwy} /><path className="ms-hwy" d={streets.hwy} /><path className="ms-br" d={streets.bridge} />
            </g>
          )}
          <path className="mroute" d={route} strokeWidth={f(2.2)} strokeDasharray={`${f(0.1)} ${f(6)}`} />
          <g className="mhubs">{ORDER.map((id) => <circle key={id} className="mhub" cx={hubOf(id)[0]} cy={hubOf(id)[1]} r={f(8)} strokeWidth={f(2.6)} />)}</g>
          {zoomed && (
            <g className="mlabs">
              {Object.values(geo.con).flatMap((c) => Object.entries(c.hoods).filter(([, h]) => !h.fill).map(([n, h]) => (
                <text key={n} className="mnlab" x={h.c[0]} y={h.c[1]} fontSize={f(10)} strokeWidth={f(3)}>{n.replace("Central Park West / West 80s–90s", "CPW · West 80s–90s")}</text>
              )))}
            </g>
          )}
          {stars}
          {!zoomed && CONSTELLATIONS.map((c, i) => {
            const w = Math.round(Math.max(52 + c.name.length * 9.7, 48 + c.status.length * 5.9)), h = 44, hub = hubOf(c.id);
            let [bx] = CALLOUT[c.id]; const by = CALLOUT[c.id][1];
            if (bx < 0) bx = VW + bx - w;
            const ax = Math.max(bx, Math.min(bx + w, hub[0])), ay = hub[1] < by ? by : hub[1] > by + h ? by + h : by + h / 2;
            const lx = hub[0] < bx ? bx : hub[0] > bx + w ? bx + w : ax;
            return (
              <g key={c.id} className="mcall" tabIndex={0} role="button" aria-label={`${c.name}: ${c.status}`} {...press(() => onCon(c.id))}>
                <path className="mlead" d={`M${lx} ${ay}L${hub[0]} ${hub[1]}`} />
                <rect x={bx} y={by} width={w} height={h} className="mbox" />
                <rect x={bx} y={by} width={30} height={h} className={cn("mnum", `mz-fill--${c.id}`)} />
                <text x={bx + 15} y={by + h / 2 + 1} className="mcn">{i + 1}</text>
                <text x={bx + 38} y={by + 19} className="mct">{c.name}</text>
                <text x={bx + 38} y={by + 34} className="mcs">{c.status}</text>
              </g>
            );
          })}
          <g className="mnorth" transform={`translate(${(target[0] + target[2] - 26 * z).toFixed(1)} ${(target[1] + target[3] - 34 * z).toFixed(1)}) scale(${z.toFixed(3)})`}>
            <path d="M0 -14L6 6L0 2L-6 6Z" /><text y="18">N</text>
          </g>
        </svg>
        {zoomed && <button type="button" className="dmap-all" onClick={() => onCon("all")}>← All five constellations</button>}
      </div>
      <figcaption>
        <div className="dmap-lgd">
          <b>Legend</b>
          <span><svg viewBox="-9 -9 18 18" width="14" height="14" aria-hidden><path d={sparkPath(0, 0, 8)} className="mstar" /></svg>Member</span>
          <span><svg viewBox="-9 -9 18 18" width="14" height="14" aria-hidden><circle r="6" className="mhub" strokeWidth="2.4" /></svg>Constellation hub</span>
        </div>
        <p>Tap a constellation to filter the directory. Members show at their neighborhood only, never an address.</p>
      </figcaption>
    </figure>
  );
}
