import inkLogo from "../assets/logos/the-womens-collective-ink.png";
import whiteLogo from "../assets/logos/the-womens-collective-white.png";
import licLogo from "../assets/logos/the-womens-collective-lic.png";
import sunnysideLogo from "../assets/logos/the-womens-collective-sunnyside.png";
import astoriaLogo from "../assets/logos/the-womens-collective-astoria.png";
import jacksonHeightsLogo from "../assets/logos/the-womens-collective-jackson-heights.png";
import elmhurstLogo from "../assets/logos/the-womens-collective-elmhurst.png";
import forestHillsLogo from "../assets/logos/the-womens-collective-forest-hills.png";
import regoParkLogo from "../assets/logos/the-womens-collective-rego-park.png";
// Downscales of the same PNGs (lossless WebP, `cwebp -lossless -z 9 -resize W 0`): pixel count only, the geometry is
// the original's. Regenerate them if a PNG changes.
import ink128 from "../assets/logos/the-womens-collective-ink-128.webp";
import ink256 from "../assets/logos/the-womens-collective-ink-256.webp";
import white128 from "../assets/logos/the-womens-collective-white-128.webp";
import white256 from "../assets/logos/the-womens-collective-white-256.webp";
import lic128 from "../assets/logos/the-womens-collective-lic-128.webp";
import lic256 from "../assets/logos/the-womens-collective-lic-256.webp";
import sunnyside128 from "../assets/logos/the-womens-collective-sunnyside-128.webp";
import sunnyside256 from "../assets/logos/the-womens-collective-sunnyside-256.webp";
import astoria128 from "../assets/logos/the-womens-collective-astoria-128.webp";
import astoria256 from "../assets/logos/the-womens-collective-astoria-256.webp";
import jacksonHeights128 from "../assets/logos/the-womens-collective-jackson-heights-128.webp";
import jacksonHeights256 from "../assets/logos/the-womens-collective-jackson-heights-256.webp";
import elmhurst128 from "../assets/logos/the-womens-collective-elmhurst-128.webp";
import elmhurst256 from "../assets/logos/the-womens-collective-elmhurst-256.webp";
import forestHills128 from "../assets/logos/the-womens-collective-forest-hills-128.webp";
import forestHills256 from "../assets/logos/the-womens-collective-forest-hills-256.webp";
import regoPark128 from "../assets/logos/the-womens-collective-rego-park-128.webp";
import regoPark256 from "../assets/logos/the-womens-collective-rego-park-256.webp";

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
export const CONSTELLATION_LOGO_SIZE = { width: 471, height: 495 } as const;

const set = (s128: string, s256: string, png: string) => `${s128} 128w, ${s256} 256w, ${png} 471w`;

/** `srcset` per variant: 128 and 256 px downscales, then the original PNG. */
export const constellationLogoSrcSets: Record<keyof typeof constellationLogoSources, string> = {
  ink: set(ink128, ink256, inkLogo),
  white: set(white128, white256, whiteLogo),
  "long-island-city": set(lic128, lic256, licLogo),
  sunnyside: set(sunnyside128, sunnyside256, sunnysideLogo),
  astoria: set(astoria128, astoria256, astoriaLogo),
  "jackson-heights": set(jacksonHeights128, jacksonHeights256, jacksonHeightsLogo),
  elmhurst: set(elmhurst128, elmhurst256, elmhurstLogo),
  "forest-hills": set(forestHills128, forestHills256, forestHillsLogo),
  "rego-park": set(regoPark128, regoPark256, regoParkLogo),
};

/** The `srcset` for a bundled logo's PNG URL; undefined for anything else (an uploaded logo has no downscales). */
export function constellationLogoSrcSet(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const key = (Object.keys(constellationLogoSources) as (keyof typeof constellationLogoSources)[]).find((k) => constellationLogoSources[k] === src);
  return key && constellationLogoSrcSets[key];
}
