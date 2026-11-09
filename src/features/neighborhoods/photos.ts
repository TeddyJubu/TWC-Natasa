// Bundled neighborhood photography, keyed by neighborhood slug. A neighborhood added in admin has none:
// its pages fall back to a color + logo tile, never a stand-in photo.
import lic from "@/assets/photography/neighborhood-lic.jpg";
import sunnyside from "@/assets/photography/neighborhood-sunnyside.jpg";
import astoria from "@/assets/photography/neighborhood-astoria.jpg";
import jacksonHeights from "@/assets/photography/neighborhood-jackson-heights.jpg";
import elmhurst from "@/assets/photography/neighborhood-elmhurst.jpg";
import forestHills from "@/assets/photography/neighborhood-forest-hills.jpg";
import regoPark from "@/assets/photography/neighborhood-rego-park.jpg";
import { neighborhoodSrcSet } from "@/app/responsive-images";

type VariantKey = Parameters<typeof neighborhoodSrcSet>[0];

const PHOTOS: Record<string, [src: string, variant: VariantKey]> = {
  "long-island-city": [lic, "lic"],
  sunnyside: [sunnyside, "sunnyside"],
  astoria: [astoria, "astoria"],
  "jackson-heights": [jacksonHeights, "jackson-heights"],
  elmhurst: [elmhurst, "elmhurst"],
  "forest-hills": [forestHills, "forest-hills"],
  "rego-park": [regoPark, "rego-park"],
};

/** The slug's photo (816px original + 480w WebP), or undefined when there is none. */
export function neighborhoodPhoto(slug: string): { src: string; srcSet: string } | undefined {
  const hit = Object.hasOwn(PHOTOS, slug) ? PHOTOS[slug] : undefined;
  return hit && { src: hit[0], srcSet: neighborhoodSrcSet(hit[1], hit[0]) };
}
