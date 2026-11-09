import { describe, expect, it } from "vitest";
import { routeExists } from "../../scripts/migration-check.ts";

describe("migration-check routeExists", () => {
  it("finds public top-level routes", () => {
    expect(routeExists("/about")).toBe(true);
    expect(routeExists("/fellowship")).toBe(true);
    expect(routeExists("/join")).toBe(true);
  });

  it("finds routes under pathless layout folders", () => {
    expect(routeExists("/account")).toBe(true);
    expect(routeExists("/admin")).toBe(true);
  });

  it("finds dynamic members pages", () => {
    expect(routeExists("/members/anyone")).toBe(true);
  });

  it("rejects unknown paths", () => {
    expect(routeExists("/no-such-page-xyz")).toBe(false);
  });
});
