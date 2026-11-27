// The design canvas's five constellations (docs/design-canvas/, CON): their words, status and colour field. Only the founder
// is named here; any other lead's name comes from the roster. No member counts: a chart draws only the roster's members.
type Short = "NB" | "WQ" | "SB" | "UP" | "DT";
export const CONSTELLATIONS: { short: Short; name: string; status: string; live: boolean; field: string; hoods: string;
  /** Who leads it when the roster names nobody; none where only the roster can say. */ led?: string;
  /** Offer the letter's signup ("Get launch news", `/#letter`) to women who live there before it opens. */ news?: true; body: string }[] = [
  { short: "NB", name: "North Brooklyn", status: "Live · Founding 50", live: true, field: "twc-c-band-lime", hoods: "Greenpoint — Williamsburg — Bushwick", led: "Nataša Tuohy",
    body: "The first constellation, where the Collective began: women who live and work in Greenpoint, Williamsburg and Bushwick." },
  { short: "WQ", name: "Western Queens", status: "Live", live: true, field: "twc-c-band-purple", hoods: "Astoria — Long Island City — Hunters Point — Sunnyside — Woodside — Jackson Heights",
    body: "Sunday coffees in Astoria, headshot days and a growing table of makers, agents and teachers." },
  { short: "SB", name: "Brownstone Brooklyn", status: "Launching", live: false, news: true, field: "twc-c-sky", hoods: "Red Hook — Carroll Gardens — Cobble Hill — Boerum Hill — Park Slope",
    led: "Ambassador onboarding", body: "Our next constellation. Live nearby? Get the letter and hear first when it opens." },
  { short: "UP", name: "Uptown Manhattan", status: "Ambassador wanted", live: false, field: "twc-c-band-butter", hoods: "Lincoln Square — Upper West Side — Central Park West / West 80s–90s — Carnegie Hill — Upper East Side",
    led: "Looking for 2 ambassadors", body: "Every neighborhood is led by two or three women who live there. This one is waiting for its leads." },
  { short: "DT", name: "Downtown Manhattan", status: "Ambassador wanted", live: false, field: "twc-c-band-red", hoods: "West Village — Greenwich Village — SoHo — Hudson Square — Tribeca",
    led: "Looking for 2 ambassadors", body: "Every neighborhood is led by two or three women who live there. This one is waiting for its leads." },
];
