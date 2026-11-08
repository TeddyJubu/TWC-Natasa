// @vitest-environment jsdom
// T25 + T29: subset WOFF2 fonts with TTF fallback and a display-face preload; responsive photos; direct logo variants.
import { readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { constellationLogoSources, displayFontUrl } from "@/index";
import { renderWithQueries } from "@/test/dom";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route as Root } from "@/routes/__root";
import { Route as Home } from "@/routes/index";

afterEach(cleanup);

const cwd = process.cwd();
const theme = readFileSync(`${cwd}/src/design-system/styles/theme.css`, "utf8");

describe("fonts", () => {
  const faces = [...theme.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);

  it.each(["gilda-display-400", "inter-400", "inter-500"])("%s: subset WOFF2 first, TTF as the format() fallback", (name) => {
    const face = faces.find((f) => f.includes(`${name}.`));
    expect(face).toBeDefined();
    const src = face!.match(/src:\s*([^;]+);/)![1];
    expect(src).toMatch(new RegExp(`^url\\("\\.\\./assets/fonts/${name}\\.woff2"\\) format\\("woff2"\\),\\s*url\\("\\.\\./assets/fonts/${name}\\.ttf"\\) format\\("truetype"\\)$`));
    const woff2 = statSync(`${cwd}/src/design-system/assets/fonts/${name}.woff2`).size;
    const ttf = statSync(`${cwd}/src/design-system/assets/fonts/${name}.ttf`).size;
    expect(woff2).toBeLessThan(ttf / 2);
  });

  it("the root preloads the display face (the same URL the @font-face resolves)", () => {
    expect(displayFontUrl).toMatch(/gilda-display-400.*\.woff2$/);
    const { links } = (Root.options.head as (ctx: unknown) => { links: Record<string, string>[] })({ matches: [{ pathname: "/" }] });
    expect(links).toContainEqual({ rel: "preload", href: displayFontUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  });
});

describe("homepage images", () => {
  const renderHome = () => {
    const Page = Home.options.component as React.ComponentType;
    renderWithQueries(<Page />, [[["public-profiles"], []]]);
  };
  const widths = (img: HTMLElement) => (img.getAttribute("srcset") ?? "").split(",").map((c) => c.trim().split(/\s+/)[1]);

  it("hero: high fetch priority and a WebP srcset across viewport widths", () => {
    renderHome();
    const hero = screen.getByAltText("Woman standing in a field beneath an open sky");
    expect(hero.getAttribute("fetchpriority")).toBe("high");
    expect(hero.getAttribute("loading")).not.toBe("lazy");
    expect(widths(hero)).toEqual(["960w", "1280w", "1920w"]);
    expect(hero.getAttribute("srcset")).toMatch(/hero-960\.webp 960w/);
    // min-h 60rem + object-cover: a 3:2 photo is never drawn narrower than 90rem, even on a phone.
    expect(hero.getAttribute("sizes")).toBe("(min-width: 90rem) 100vw, 90rem");
  });

  it("hero info thumbnail uses the small event variant", () => {
    renderHome();
    const thumb = document.querySelector("section img[src*='event']")!;
    expect(thumb.getAttribute("src")).toMatch(/event-320\.webp$/);
  });

  it("founder photo: 640/1280 WebP variants plus the original, with sizes", () => {
    renderHome();
    const founder = screen.getByAltText("Nataša Tuohy, founder of The Women’s Collective");
    expect(widths(founder)).toEqual(["640w", "1280w", "1997w"]);
    expect(founder.getAttribute("sizes")).toBeTruthy();
  });

  it("neighborhood cards: a 480px WebP candidate, sizes, and the white or ink logo used directly", () => {
    renderHome();
    const cards = [...document.querySelectorAll("#constellation article")];
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      const photo = card.querySelector("img[alt$=', Queens']")!;
      expect(photo.getAttribute("srcset")).toMatch(/-480\.webp 480w/);
      expect(photo.getAttribute("sizes")).toBeTruthy();
      const logo = card.querySelector("img[alt='']")!;
      expect([constellationLogoSources.white, constellationLogoSources.ink]).toContain(logo.getAttribute("src"));
      expect(logo.className).not.toMatch(/invert|brightness-0/);
    }
  });

  it("the photo feature card serves an 800px WebP candidate", () => {
    renderHome();
    const photo = document.querySelector("#take-part img")!;
    expect(photo.getAttribute("srcset")).toMatch(/event-800\.webp 800w/);
    expect(photo.getAttribute("sizes")).toBeTruthy();
  });
});
