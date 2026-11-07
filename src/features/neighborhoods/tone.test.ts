import { describe, expect, it } from "vitest";
import { constellationLogoSources } from "@/index";
import { toneFor } from "./tone";
import { NEIGHBORHOOD_SEED, type Neighborhood } from "./queries";

describe("toneFor", () => {
  it("prefers an uploaded logo over the bundled one", () => {
    const list: Neighborhood[] = [{ slug: "astoria", name: "Astoria", color: "#ff9a1f", logoUrl: "https://x/a.png" }];
    expect(toneFor("Astoria", list)).toEqual({ color: "#ff9a1f", logoSrc: "https://x/a.png" });
  });

  it("uses the bundled logo for an original slug without an upload", () => {
    expect(toneFor("Astoria", NEIGHBORHOOD_SEED)?.logoSrc).toBe(constellationLogoSources["astoria"]);
  });

  it("returns color only for a new non-seed neighborhood", () => {
    const list: Neighborhood[] = [{ slug: "ink", name: "Ink Town", color: "#123456", logoUrl: null }];
    const tone = toneFor("Ink Town", list);
    expect(tone?.color).toBe("#123456");
    expect(tone?.logoSrc).toBeUndefined();
  });

  it("returns undefined for an unknown name", () => {
    expect(toneFor("Nowhere", NEIGHBORHOOD_SEED)).toBeUndefined();
  });
});
