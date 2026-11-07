import { constellationLogoSources, type MemberCardTone } from "@/index";
import { NEIGHBORHOOD_SEED, type Neighborhood } from "./queries";

const bundledSlugs = new Set(NEIGHBORHOOD_SEED.map((n) => n.slug));

export function toneFor(name: string, list: Neighborhood[]): MemberCardTone | undefined {
  const n = list.find((item) => item.name === name);
  if (!n) return undefined;
  const bundled = bundledSlugs.has(n.slug)
    ? constellationLogoSources[n.slug as keyof typeof constellationLogoSources]
    : undefined;
  return { color: n.color, logoSrc: n.logoUrl ?? bundled };
}
