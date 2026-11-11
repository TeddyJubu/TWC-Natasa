// Resized WebP variants of the site's photography, as `srcset` strings; the original stays the `src`. Variants were
// made with `cwebp -q 76 -m 6 -resize W 0`; regenerate them if an original changes. A `sizes` value is the width the
// photo is *drawn* at, which is wider than its box where `object-cover` crops the sides, so no variant is ever upscaled.
import heroRock from "@/assets/photography/home/hero-rock.webp";
import heroRock960 from "@/assets/photography/home/hero-rock-960.webp";
import heroRock1280 from "@/assets/photography/home/hero-rock-1280.webp";
import heroRock1600 from "@/assets/photography/home/hero-rock-1600.webp";
import aboutGathering from "@/assets/photography/site/about-gathering.webp";
import aboutGathering800 from "@/assets/photography/site/about-gathering-800.webp";
import membersGathering from "@/assets/photography/site/members-gathering.webp";
import membersGathering800 from "@/assets/photography/site/members-gathering-800.webp";
import membersGathering1080 from "@/assets/photography/site/members-gathering-1080.webp";
import gatheringCeramics from "@/assets/photography/site/gathering-ceramics.webp";
import gatheringCeramics800 from "@/assets/photography/site/gathering-ceramics-800.webp";
import gatheringCeramics1280 from "@/assets/photography/site/gathering-ceramics-1280.webp";
import event800 from "@/assets/photography/event-800.webp";
import event from "@/assets/photography/event.jpg";
import lic480 from "@/assets/photography/neighborhood-lic-480.webp";
import sunnyside480 from "@/assets/photography/neighborhood-sunnyside-480.webp";
import astoria480 from "@/assets/photography/neighborhood-astoria-480.webp";
import jacksonHeights480 from "@/assets/photography/neighborhood-jackson-heights-480.webp";
import elmhurst480 from "@/assets/photography/neighborhood-elmhurst-480.webp";
import forestHills480 from "@/assets/photography/neighborhood-forest-hills-480.webp";
import regoPark480 from "@/assets/photography/neighborhood-rego-park-480.webp";

/**
 * Home hero (1920×1280, 3:2) at `scale-110` in the `wrap` column: 358/440 on phones (taller than 3:2, so cover draws
 * it about 2× the column's width), 16/10 from sm and 1312/600 from lg (both wider, so 1.1× the column).
 */
export const heroRockSrcSet = `${heroRock960} 960w, ${heroRock1280} 1280w, ${heroRock1600} 1600w, ${heroRock} 1920w`;
export const heroRockSizes = "(min-width: 90rem) 1444px, (min-width: 64rem) calc(110vw - 141px), (min-width: 40rem) calc(110vw - 35px), calc(203vw - 65px)";

/** /about arch (1280×1600, 4:5) in a 5:7 box at most 300px wide: cover draws it at most 336px wide. */
export const aboutGatheringSrcSet = `${aboutGathering800} 800w, ${aboutGathering} 1280w`;
export const aboutGatheringSizes = "336px";

/** /fellowship arch (1600×1069, 3:2) in a 5:6 box at most 300px wide: cover draws it at most 540px wide. */
export const membersGatheringSrcSet = `${membersGathering800} 800w, ${membersGathering1080} 1080w, ${membersGathering} 1600w`;
export const membersGatheringSizes = "540px";

/** /partnerships arch (1600×1067, 3:2) in a 5:6 box at most 340px wide: cover draws it at most 612px wide. */
export const gatheringCeramicsSrcSet = `${gatheringCeramics800} 800w, ${gatheringCeramics1280} 1280w, ${gatheringCeramics} 1600w`;
export const gatheringCeramicsSizes = "612px";

/** Photo feature card: one of three columns from md up. */
export const eventSrcSet = `${event800} 800w, ${event} 1280w`;
export const eventSizes = "(min-width: 48rem) 33vw, 100vw";
/** The founder band's small polaroid: half of a 350/440/540px frame, less its padding. */
export const eventPolaroidSizes = "(min-width: 80rem) 270px, (min-width: 64rem) 220px, 175px";

/** Neighborhood photos: 480w WebP, then the 816px original. */
const hood480 = { lic: lic480, sunnyside: sunnyside480, astoria: astoria480, "jackson-heights": jacksonHeights480, elmhurst: elmhurst480, "forest-hills": forestHills480, "rego-park": regoPark480 };
export const neighborhoodSrcSet = (slug: keyof typeof hood480, original: string) => `${hood480[slug]} 480w, ${original} 816w`;
