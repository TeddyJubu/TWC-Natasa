// @vitest-environment jsdom
// T25 + T29: subset WOFF2 fonts with TTF fallback and a display-face preload; homepage photo loading.
import { readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { displayFontUrl } from "@/index";
import { renderWithQueries } from "@/test/dom";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route as Root } from "@/routes/__root";
import { Route as Home } from "@/routes/index";

afterEach(cleanup);
vi.spyOn(Home, "useLoaderData").mockReturnValue(undefined as never);

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

  const heroPolaroid = "Women laughing together at an evening rooftop gathering";

  it("hero: high fetch priority, never lazy, with downscales up to the 1920w original", () => {
    renderHome();
    const hero = screen.getByAltText("A woman in sunglasses sitting on a sunlit rock beneath a wide blue sky");
    expect(hero.getAttribute("fetchpriority")).toBe("high");
    expect(hero.getAttribute("loading")).not.toBe("lazy");
    const srcset = hero.getAttribute("srcset")!;
    for (const w of [960, 1280, 1600]) expect(srcset).toMatch(new RegExp(`hero-rock-${w}\\.webp ${w}w`));
    expect(srcset).toMatch(/hero-rock\.webp 1920w$/);
    // Phones draw the 3:2 photo about twice the column's width (cover on a 358/440 box, scale-110).
    expect(hero.getAttribute("sizes")).toMatch(/calc\(203vw - 65px\)$/);
  });

  it("the polaroid over the hero is above the fold: eager, not lazy", () => {
    renderHome();
    expect(screen.getByAltText(heroPolaroid).getAttribute("loading")).toBe("eager");
  });

  it("the founder band's gathering polaroid serves the 800px WebP at its own small sizes", () => {
    renderHome();
    const photo = screen.getByAltText("Members of the collective together in person");
    expect(photo.getAttribute("srcset")).toMatch(/event-800\.webp 800w/);
    expect(photo.getAttribute("sizes")).toBe("(min-width: 80rem) 270px, (min-width: 64rem) 220px, 175px");
  });

  it("every other photo is lazy and has alt text (empty only when decorative)", () => {
    renderHome();
    const imgs = [...document.querySelectorAll("main img")].filter((i) => i.getAttribute("fetchpriority") !== "high" && i.getAttribute("alt") !== heroPolaroid);
    expect(imgs.length).toBeGreaterThan(5);
    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.hasAttribute("alt")).toBe(true);
    }
  });

  it("the bricklayer photo serves an 800px WebP candidate", () => {
    renderHome();
    const photo = document.querySelector("#take-part img")!;
    expect(photo.getAttribute("srcset")).toMatch(/event-800\.webp 800w/);
    expect(photo.getAttribute("sizes")).toBeTruthy();
  });
});
