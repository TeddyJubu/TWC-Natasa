import { describe, expect, it } from "vitest";
import { constellationLogoSources } from "@/index";
import { toneFor } from "./tone";
import { NEIGHBORHOOD_SEED, type Neighborhood } from "./queries";

describe("toneFor", () => {
  it("prefers an uploaded logo over the bundled one", () => {
    const list: Neighborhood[] = [{ slug: "astoria", name: "Astoria", color: "#ff9a1f", logoUrl: "https://x/a.png", active: true }];
    expect(toneFor("Astoria", list)).toEqual({ color: "#ff9a1f", logoSrc: "https://x/a.png" });
  });

  it("uses the bundled logo for an original slug without an upload", () => {
    expect(toneFor("Astoria", NEIGHBORHOOD_SEED)?.logoSrc).toBe(constellationLogoSources["astoria"]);
  });

  it("returns color only for a new non-seed neighborhood", () => {
    const list: Neighborhood[] = [{ slug: "ink", name: "Ink Town", color: "#123456", logoUrl: null, active: true }];
    const tone = toneFor("Ink Town", list);
    expect(tone?.color).toBe("#123456");
    expect(tone?.logoSrc).toBeUndefined();
  });

  it("keeps a deactivated neighborhood's color and logo for cards that still use it", () => {
    const list: Neighborhood[] = [{ slug: "rego-park", name: "Rego Park", color: "#ff4438", logoUrl: null, active: false }];
    expect(toneFor("Rego Park", list)).toEqual({ color: "#ff4438", logoSrc: constellationLogoSources["rego-park"] });
  });

  it("returns undefined for an unknown name", () => {
    expect(toneFor("Nowhere", NEIGHBORHOOD_SEED)).toBeUndefined();
  });

  it("returns undefined when no neighborhood is set", () => {
    expect(toneFor(null, NEIGHBORHOOD_SEED)).toBeUndefined();
  });
});
