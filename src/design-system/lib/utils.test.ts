import { describe, expect, it } from "vitest";
import { initials } from "./utils";

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("rosa maria diaz")).toBe("RM");
  });
  it("uses a single letter for a one-word name", () => {
    expect(initials("Rosa")).toBe("R");
  });
  it("ignores extra whitespace", () => {
    expect(initials("  pia   lund ")).toBe("PL");
  });
  it("falls back to TWC for an empty name", () => {
    expect(initials("  ")).toBe("TWC");
  });
});
