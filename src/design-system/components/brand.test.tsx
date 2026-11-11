// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ConstellationLogo } from "./brand";
import { constellationLogoSources, constellationLogoSrcSet, constellationLogoSrcSets } from "../lib/logo-sources";

afterEach(cleanup);

const img = () => document.querySelector("img")!;

describe("ConstellationLogo", () => {
  it("offers 128w and 256w downscales before the 471w original PNG, with its pixel size", () => {
    render(<ConstellationLogo variant="astoria" />);
    expect(img().getAttribute("src")).toBe(constellationLogoSources.astoria);
    expect(img().getAttribute("srcset")).toMatch(/astoria-128\.webp 128w, \S*astoria-256\.webp 256w, \S*astoria\.png 471w$/);
    expect([img().getAttribute("width"), img().getAttribute("height")]).toEqual(["471", "495"]);
  });

  it.each([
    [undefined, "64px"],
    ["sm", "36px"],
    ["lg", "112px"],
    ["display", "(min-width: 48rem) 240px, 176px"],
  ] as const)("size %s draws at %s by default", (size, sizes) => {
    render(<ConstellationLogo size={size} />);
    expect(img().getAttribute("sizes")).toBe(sizes);
  });

  it("a caller's own sizes wins", () => {
    render(<ConstellationLogo sizes="28px" className="w-7" />);
    expect(img().getAttribute("sizes")).toBe("28px");
  });
});

describe("constellationLogoSrcSet", () => {
  it("finds a bundled PNG's srcset and nothing for an uploaded logo or none", () => {
    expect(constellationLogoSrcSet(constellationLogoSources["rego-park"])).toBe(constellationLogoSrcSets["rego-park"]);
    expect(constellationLogoSrcSet("/media/neighborhood-logos/woodside.png")).toBeUndefined();
    expect(constellationLogoSrcSet(undefined)).toBeUndefined();
  });

  it("every variant has its two downscales", () => {
    for (const [key, set] of Object.entries(constellationLogoSrcSets)) {
      expect(set.split(", ").map((c) => c.split(" ")[1]), key).toEqual(["128w", "256w", "471w"]);
    }
  });
});
