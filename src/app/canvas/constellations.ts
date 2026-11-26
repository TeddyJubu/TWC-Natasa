// The design canvas's five constellations (docs/design-canvas/, CON): their words, status and colour field. Only the founder
// is named here; any other lead's name comes from the roster.
type Short = "NB" | "WQ" | "SB" | "UP" | "DT";
export const CONSTELLATIONS: { short: Short; name: string; status: string; live: boolean; field: string; hoods: string; led: string; /** Stars on its chart (the canvas's star counts): its members, named or not. */ stars: number; head?: string; body: string }[] = [
  { short: "NB", stars: 50, name: "North Brooklyn", status: "Live · Founding 50", live: true, field: "twc-c-band-lime", hoods: "Greenpoint — Williamsburg — Bushwick", led: "Nataša Tuohy",
    head: "The women behind the Collective", body: "A constellation of talent, ambition, and local connections. Meet the women shaping our community." },
  { short: "WQ", stars: 24, name: "Western Queens", status: "Live", live: true, field: "twc-c-band-purple", hoods: "Astoria — Long Island City — Hunters Point — Sunnyside — Woodside — Jackson Heights", led: "Ambassador-led",
    body: "Sunday coffees in Astoria, headshot days and a growing table of makers, agents and teachers." },
  { short: "SB", stars: 15, name: "Brownstone Brooklyn", status: "Launching", live: false, field: "twc-c-sky", hoods: "Red Hook — Carroll Gardens — Cobble Hill — Boerum Hill — Park Slope",
    led: "Ambassador onboarding", body: "Our next constellation. The launch coffee is on the calendar for December." },
  { short: "UP", stars: 0, name: "Uptown Manhattan", status: "Ambassador wanted", live: false, field: "twc-c-band-butter", hoods: "Lincoln Square — Upper West Side — Central Park West / West 80s–90s — Carnegie Hill — Upper East Side",
    led: "Looking for 2 ambassadors", body: "Every neighborhood is led by two or three women who live there. This one is waiting for its leads." },
  { short: "DT", stars: 0, name: "Downtown Manhattan", status: "Ambassador wanted", live: false, field: "twc-c-band-red", hoods: "West Village — Greenwich Village — SoHo — Hudson Square — Tribeca",
    led: "Looking for 2 ambassadors", body: "Every neighborhood is led by two or three women who live there. This one is waiting for its leads." },
];
