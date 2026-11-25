import inkLogo from "../assets/logos/the-womens-collective-ink.png";
import whiteLogo from "../assets/logos/the-womens-collective-white.png";
import licLogo from "../assets/logos/the-womens-collective-lic.png";
import sunnysideLogo from "../assets/logos/the-womens-collective-sunnyside.png";
import astoriaLogo from "../assets/logos/the-womens-collective-astoria.png";
import jacksonHeightsLogo from "../assets/logos/the-womens-collective-jackson-heights.png";
import elmhurstLogo from "../assets/logos/the-womens-collective-elmhurst.png";
import forestHillsLogo from "../assets/logos/the-womens-collective-forest-hills.png";
import regoParkLogo from "../assets/logos/the-womens-collective-rego-park.png";
// The three-star mark (docs/design-canvas/logos/mark-*.webp, 168×240; neighborhood colours are the ink mark's alpha
// filled with the colour). 128px downscales: lossless WebP, `cwebp -lossless -z 9 -resize 128 0`. Regenerate if a PNG changes.
import ink128 from "../assets/logos/the-womens-collective-ink-128.webp";
import white128 from "../assets/logos/the-womens-collective-white-128.webp";
import lic128 from "../assets/logos/the-womens-collective-lic-128.webp";
import sunnyside128 from "../assets/logos/the-womens-collective-sunnyside-128.webp";
import astoria128 from "../assets/logos/the-womens-collective-astoria-128.webp";
import jacksonHeights128 from "../assets/logos/the-womens-collective-jackson-heights-128.webp";
import elmhurst128 from "../assets/logos/the-womens-collective-elmhurst-128.webp";
import forestHills128 from "../assets/logos/the-womens-collective-forest-hills-128.webp";
import regoPark128 from "../assets/logos/the-womens-collective-rego-park-128.webp";
import lockupInk from "../assets/logos/the-womens-collective-lockup-ink.webp";

export const constellationLogoSources = {
  ink: inkLogo,
  white: whiteLogo,
  "long-island-city": licLogo,
  sunnyside: sunnysideLogo,
  astoria: astoriaLogo,
  "jackson-heights": jacksonHeightsLogo,
  elmhurst: elmhurstLogo,
  "forest-hills": forestHillsLogo,
  "rego-park": regoParkLogo,
} as const;

/** The original PNGs' pixel size, for `width`/`height` (no layout shift while a logo loads). */
export const CONSTELLATION_LOGO_SIZE = { width: 168, height: 240 } as const;

const set = (s128: string, png: string) => `${s128} 128w, ${png} 168w`;

/** `srcset` per variant: a 128 px downscale, then the original PNG. */
export const constellationLogoSrcSets: Record<keyof typeof constellationLogoSources, string> = {
  ink: set(ink128, inkLogo),
  white: set(white128, whiteLogo),
  "long-island-city": set(lic128, licLogo),
  sunnyside: set(sunnyside128, sunnysideLogo),
  astoria: set(astoria128, astoriaLogo),
  "jackson-heights": set(jacksonHeights128, jacksonHeightsLogo),
  elmhurst: set(elmhurst128, elmhurstLogo),
  "forest-hills": set(forestHills128, forestHillsLogo),
  "rego-park": set(regoPark128, regoParkLogo),
};

/** The `srcset` for a bundled logo's PNG URL; undefined for anything else (an uploaded logo has no downscales). */
export function constellationLogoSrcSet(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const key = (Object.keys(constellationLogoSources) as (keyof typeof constellationLogoSources)[]).find((k) => constellationLogoSources[k] === src);
  return key && constellationLogoSrcSets[key];
}

/** The wordmark lockup: the three stars beside "The Women's Collective" (docs/design-canvas/logos/twc-ink.webp). */
export const LOCKUP = { src: lockupInk, width: 770, height: 400 } as const;
