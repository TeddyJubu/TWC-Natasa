import { describe, expect, it } from "vitest";
import { NEIGHBORHOOD_SEED } from "./queries";
import { PLACES, formatCoords } from "./places";

describe("neighborhood places", () => {
  it("places every seeded neighborhood in Queens, with a five-digit 11xxx ZIP and at least one line", () => {
    expect(Object.keys(PLACES).sort()).toEqual(NEIGHBORHOOD_SEED.map((h) => h.slug).sort());
    for (const { center: [lng, lat], zip, lines } of Object.values(PLACES)) {
      expect(lat).toBeGreaterThan(40.68); expect(lat).toBeLessThan(40.8);
      expect(lng).toBeGreaterThan(-73.97); expect(lng).toBeLessThan(-73.8);
      expect(zip).toMatch(/^11\d{3}$/);
      expect(lines.length).toBeGreaterThan(0);
    }
  });

  it("formats coordinates the postal way", () => {
    expect(formatCoords([-73.9186, 40.7432])).toBe("40.7432° N · 73.9186° W");
  });
});
