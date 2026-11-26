/* The design canvas's constellation chart (docs/design-canvas/, starChart()): each neighborhood a hub star on a
   dashed route, one spark per real roster member in her neighborhood (rosterQuery; never a member in this public
   repository), each hub labelled with its count, and an open seat ("Your star here") where a neighborhood has none.
   Every spark is a named member, so nothing twinkles. Seeded, so the server and the browser draw the same SVG. */

// Hub positions (0–1 of the chart) and label sides from the canvas; label colours darkened to AA on white.
const HOOD_POS: Record<string, Record<string, [number, number, string, ("l" | "r" | "b")?]>> = {
  NB: { Greenpoint: [0.16, 0.1, "#2b823a"], Williamsburg: [0.32, 0.66, "#2778b4", "l"], Bushwick: [0.66, 0.5, "#da3029"] },
  WQ: { Astoria: [0.2, 0.06, "#ac613a"], "Long Island City": [0.08, 0.44, "#147d98", "r"], "Hunters Point": [0.06, 0.82, "#b15b57", "b"],
    Sunnyside: [0.4, 0.62, "#7f5bd5"], Woodside: [0.62, 0.8, "#238173", "b"], "Jackson Heights": [0.86, 0.4, "#b25185"] },
  SB: { "Cobble Hill": [0.22, 0.08, "#2778b4"], "Boerum Hill": [0.5, 0.06, "#7f5bd5"], "Carroll Gardens": [0.2, 0.5, "#2b823a", "l"], "Red Hook": [0.08, 0.86, "#da3029", "b"], "Park Slope": [0.78, 0.52, "#b25185"] },
  UP: { "Lincoln Square": [0.1, 0.84, "#b25185", "b"], "Upper West Side": [0.12, 0.4, "#2b823a"], "Central Park West / West 80s–90s": [0.4, 0.12, "#238173"], "Carnegie Hill": [0.84, 0.1, "#ac613a"], "Upper East Side": [0.66, 0.62, "#2778b4", "b"] },
  DT: { "West Village": [0.12, 0.08, "#2b823a"], "Greenwich Village": [0.48, 0.06, "#7f5bd5"], SoHo: [0.54, 0.5, "#b25185", "r"], "Hudson Square": [0.16, 0.5, "#147d98"], Tribeca: [0.3, 0.86, "#da3029", "b"] },
};

/** A member as the chart draws her: `id` is shared with her profile card (`data-m`) for the hover highlight. */
export type ChartMember = { id: string; name: string; hood: string; job?: string };

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f = (n: number) => n.toFixed(1);
function star(x: number, y: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; d += (i ? "L" : "M") + f(x + Math.cos(a) * rr) + " " + f(y + Math.sin(a) * rr); }
  return d + "Z";
}
function spark(x: number, y: number, r: number) {
  const k = r * 0.16;
  return `M${f(x)} ${f(y - r)}Q${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)}Q${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)}Q${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)}Q${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)}Z`;
}
const hoodsOf = (hoods: string) => hoods.split(/\s+—\s+/).map((s) => s.trim()).filter(Boolean);

const W = 960, H = 420;
type Pt = { x: number; y: number; m: ChartMember };

export function StarChart({ id, name, hoods, live, members, hl, onPick }: {
  id: string; name: string; hoods: string; live: boolean; members: ChartMember[];
  /** The highlighted member's id (her spark grows in her neighborhood's colour). */ hl?: string | null;
  /** A spark was clicked: show her card. */ onPick?: (id: string) => void;
}) {
  const rnd = rng(id), names = hoodsOf(hoods), pos = HOOD_POS[id] ?? {};
  const hubs = names.map((n, i) => {
    const p = pos[n] ?? [0.2 + (0.6 * i) / Math.max(1, names.length - 1), 0.3, "#151414"];
    return { name: n, x: 70 + p[0] * (W - 140), y: 60 + p[1] * (H - 120), col: p[2], side: p[3] ?? "t", pts: [] as Pt[], count: 0 };
  });
  const placed = hubs.map((h) => ({ x: h.x, y: h.y, r: 26 }));
  // The canvas's placement: near her hub, clear of its label, nearer her own hub than any other, spread out.
  for (const m of members) {
    const h = hubs.find((x) => x.name === m.hood) ?? hubs[0];
    h.count++;
    let best: { x: number; y: number; d: number } | null = null;
    for (let t = 0; t < 60; t++) {
      const a = rnd() * Math.PI * 2, rad = 44 + rnd() * (70 + Math.sqrt(members.length) * 10);
      const p = { x: h.x + Math.cos(a) * rad * 1.35, y: h.y + Math.sin(a) * rad * 0.85 };
      if (p.x < 16 || p.x > W - 16 || p.y < 16 || p.y > H - 30) continue;
      const onLabel = h.side === "t" ? p.y < h.y - 8 && Math.abs(p.x - h.x) < 80 && p.y > h.y - 58
        : h.side === "l" ? p.x < h.x - 12 && p.x > h.x - 190 && Math.abs(p.y - h.y) < 30
        : h.side === "r" ? p.x > h.x + 12 && p.x < h.x + 190 && Math.abs(p.y - h.y) < 30
        : p.y > h.y + 8 && p.y < h.y + 60 && Math.abs(p.x - h.x) < 80;
      if (onLabel) continue;
      const mine = Math.hypot(p.x - h.x, p.y - h.y);
      if (hubs.some((o) => o !== h && Math.hypot(p.x - o.x, p.y - o.y) < mine)) continue;
      const d = placed.reduce((mn, q) => Math.min(mn, Math.hypot(q.x - p.x, q.y - p.y) - q.r), 1e9);
      if (!best || d > best.d) best = { ...p, d };
      if (d > 22) break;
    }
    if (best) { placed.push({ x: best.x, y: best.y, r: 4 }); h.pts.push({ x: best.x, y: best.y, m }); }
  }

  const links: string[] = [], ties: string[] = [], seats: string[] = [];
  for (let i = 1; i < hubs.length; i++) links.push(`M${f(hubs[i - 1].x)} ${f(hubs[i - 1].y)}L${f(hubs[i].x)} ${f(hubs[i].y)}`);
  for (const h of hubs) {
    // Prim's tree from the hub through its sparks, as the canvas draws its dotted ties.
    const nodes: { x: number; y: number }[] = [h, ...h.pts], inT = nodes.map((_, i) => i === 0);
    for (let e = 1; e < nodes.length; e++) {
      let bi = -1, bj = -1, bd = 1e9;
      nodes.forEach((a, i) => { if (inT[i]) nodes.forEach((b, j) => { if (!inT[j]) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; bi = i; bj = j; } } }); });
      inT[bj] = true; ties.push(`M${f(nodes[bi].x)} ${f(nodes[bi].y)}L${f(nodes[bj].x)} ${f(nodes[bj].y)}`);
    }
    if (!h.pts.length) {
      const x = Math.min(W - 20, h.x + (h.side === "b" ? 80 : 56)), y = h.y + (h.side === "b" ? 0 : 62);
      ties.push(`M${f(h.x)} ${f(h.y)}L${f(x)} ${f(y)}`); seats.push(star(x, y, 9));
    }
  }
  return (
    <svg className="twc-starchart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${name} constellation: ${names.join(", ")}${members.length ? `, ${members.length} members` : ""}`}>
      <path className="sc-link" d={links.join("")} />
      <path className="sc-tie" d={ties.join("")} />
      <path className="sc-open" d={seats.join("")} />
      {hubs.map((h) => {
        const lx = h.side === "l" ? h.x - 24 : h.side === "r" ? h.x + 24 : h.x;
        const ly = h.side === "l" || h.side === "r" ? h.y - 2 : h.side === "b" ? h.y + 34 : h.y - 36;
        const anchor = h.side === "l" ? "end" : h.side === "r" ? "start" : "middle";
        return (
          // --hood: the neighborhood's colour a highlighted spark takes (DESIGN.md's one inline-style exception).
          <g key={h.name} style={{ "--hood": h.col } as React.CSSProperties}>
            {h.pts.map((p) => (
              <path key={p.m.id} d={spark(p.x, p.y, 7.5)} data-m={p.m.id} className={`sc-mem${hl === p.m.id ? " is-hl" : ""}`} onClick={() => onPick?.(p.m.id)}>
                <title>{`${p.m.name}${p.m.job ? ` · ${p.m.job}` : ""}, ${h.name}`}</title>
              </path>
            ))}
            <path className="sc-hub" d={star(h.x, h.y, 15)} />
            <text x={lx} y={ly} textAnchor={anchor} className="sc-name" fill={h.col}>{h.name.toUpperCase().replace(/(\d)S\b/g, "$1s")}</text>
            <text x={lx} y={ly + 14} textAnchor={anchor} className="sc-sub">{h.count ? `${h.count} ${h.count === 1 ? "member" : "members"}` : "Your star here"}</text>
          </g>
        );
      })}
      <text x={W - 4} y={H - 6} textAnchor="end" className="sc-sub">★ neighborhood · ✦ member{live ? "" : " · ☆ open seat"}</text>
    </svg>
  );
}
