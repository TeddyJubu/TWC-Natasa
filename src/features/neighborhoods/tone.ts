import { constellationLogoSources, type MemberCardTone } from "@/index";
import { NEIGHBORHOOD_SEED, type Neighborhood } from "./queries";

const bundledSlugs = new Set(NEIGHBORHOOD_SEED.map((n) => n.slug));

/** A neighborhood's color and logo; undefined for no neighborhood (null) or an unknown name. */
export function toneFor(name: string | null, list: Neighborhood[]): MemberCardTone | undefined {
  if (!name) return undefined;
  const n = list.find((item) => item.name === name);
  if (!n) return undefined;
  const bundled = bundledSlugs.has(n.slug)
    ? constellationLogoSources[n.slug as keyof typeof constellationLogoSources]
    : undefined;
  return { color: n.color, logoSrc: n.logoUrl ?? bundled };
}

const INK = "#1f1f1c";
const PAPER = "#fcfcfa";
const HEX = /^#[0-9a-f]{6}$/i;

/** A usable `#rrggbb` neighborhood color; anything else gets the cream + dashed-ring "no color yet" look. */
export const hasColor = (color: string | null | undefined): color is string => !!color && HEX.test(color);

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x contrast ratio of two `#rrggbb` colors (1–21). */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text on a neighborhood color: ink or paper, whichever contrasts more. Every color reaches 3:1 (large text);
 * `ratio` says whether small text (4.5:1) may sit on it too.
 */
export function textOn(color: string): { text: "ink" | "paper"; ratio: number } {
  const ink = contrastRatio(color, INK);
  const paper = contrastRatio(color, PAPER);
  return ink >= paper ? { text: "ink", ratio: ink } : { text: "paper", ratio: paper };
}
