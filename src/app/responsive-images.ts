// Resized WebP variants of the homepage photography (T29), as `srcset` strings. The original JPEGs stay the
// `src` fallback and the og:image. Variants were made with cwebp (q76); regenerate them if an original changes.
import hero960 from "@/assets/photography/hero-960.webp";
import hero1280 from "@/assets/photography/hero-1280.webp";
import hero1920 from "@/assets/photography/hero-1920.webp";
import natasa from "@/assets/photography/natasa-tuohy.jpg";
import natasa640 from "@/assets/photography/natasa-tuohy-640.webp";
import natasa1280 from "@/assets/photography/natasa-tuohy-1280.webp";
import event320 from "@/assets/photography/event-320.webp";
import event800 from "@/assets/photography/event-800.webp";
import event from "@/assets/photography/event.jpg";
import lic480 from "@/assets/photography/neighborhood-lic-480.webp";
import sunnyside480 from "@/assets/photography/neighborhood-sunnyside-480.webp";
import astoria480 from "@/assets/photography/neighborhood-astoria-480.webp";
import jacksonHeights480 from "@/assets/photography/neighborhood-jackson-heights-480.webp";
import elmhurst480 from "@/assets/photography/neighborhood-elmhurst-480.webp";
import forestHills480 from "@/assets/photography/neighborhood-forest-hills-480.webp";
import regoPark480 from "@/assets/photography/neighborhood-rego-park-480.webp";

export const heroSrcSet = `${hero960} 960w, ${hero1280} 1280w, ${hero1920} 1920w`;
/** The 3:2 hero photo covers a section at least 60rem tall, so it is never drawn narrower than 90rem. */
export const heroSizes = "(min-width: 90rem) 100vw, 90rem";

/** Founder portrait in a half-width column from md up. */
export const founderSrcSet = `${natasa640} 640w, ${natasa1280} 1280w, ${natasa} 1997w`;
export const founderSizes = "(min-width: 80rem) 36rem, (min-width: 48rem) 45vw, 100vw";

/** The hero's glass-card thumbnail is 8rem square. */
export const eventThumb = event320;
/** Photo feature card: one of three columns from md up. */
export const eventSrcSet = `${event800} 800w, ${event} 1280w`;
export const eventSizes = "(min-width: 48rem) 33vw, 100vw";

/** Neighborhood cards: 4 columns from lg, 2 from sm. Originals are 816px. */
const hood480 = { lic: lic480, sunnyside: sunnyside480, astoria: astoria480, "jackson-heights": jacksonHeights480, elmhurst: elmhurst480, "forest-hills": forestHills480, "rego-park": regoPark480 };
export const neighborhoodSrcSet = (slug: keyof typeof hood480, original: string) => `${hood480[slug]} 480w, ${original} 816w`;
export const neighborhoodSizes = "(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw";
