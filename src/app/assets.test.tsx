// @vitest-environment jsdom
// T25 + T29: self-hosted Archivo WOFF2 and its preload; homepage photo loading.
import { readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
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

  it.each(["archivo-latin-wdth-normal", "archivo-latin-ext-wdth-normal", "archivo-latin-wdth-italic"])(
    "%s: self-hosted Archivo with both variable axes (wght and wdth)",
    (name) => {
      const face = faces.find((f) => f.includes(`${name}.`));
      expect(face).toBeDefined();
      expect(face).toMatch(/font-family: "Archivo";/);
      expect(face!.match(/src:\s*([^;]+);/)![1]).toBe(`url("../assets/fonts/${name}.woff2") format("woff2")`);
      expect(face).toMatch(/font-weight: 100 900;/);
      expect(face).toMatch(/font-stretch: 62% 125%;/);
      expect(statSync(`${cwd}/src/design-system/assets/fonts/${name}.woff2`).size).toBeGreaterThan(0);
    },
  );

  it("the canvas's faces only: Archivo text, Instrument Serif headlines (self-hosted), no retired face", () => {
    const css = theme + readFileSync(`${cwd}/src/styles.css`, "utf8");
    for (const gone of ["Gilda Display", "Geist", "Inter", "Caveat", "Fragment Mono"]) expect(css).not.toContain(`"${gone}"`);
    expect(css).toMatch(/--font-serif: "Instrument Serif"/);
    expect(css).toMatch(/font-family: "Instrument Serif"; src: url\("\.\/assets\/fonts\/instrument-serif\//);
    expect(theme).toMatch(/--font-display: "Archivo"/);
    expect(theme).toMatch(/--font-sans: "Archivo"/);
  });

  it("the root preloads the Latin Archivo file (the same URL the @font-face resolves), and no other face", () => {
    expect(displayFontUrl).toMatch(/archivo-latin-wdth-normal.*\.woff2$/);
    const { links } = (Root.options.head as (ctx: unknown) => { links: Record<string, string>[] })({ matches: [{ pathname: "/" }] });
    const fonts = links.filter((l) => l.rel === "preload" && l.as === "font");
    expect(fonts).toEqual([{ rel: "preload", href: displayFontUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" }]);
  });
});

describe("homepage images", () => {
  const renderHome = () => {
    const Page = Home.options.component as React.ComponentType;
    renderWithQueries(<Page />, [[["cal", "events", { tab: "upcoming", take: 5 }], { events: [], total: 0, categories: [], host: null }]]);
  };

  // The canvas's 01 Programme opens on its constellation bands, not a photo: every photo sits below the fold.
  it("every photo is lazy, decoded off the main thread, and has alt text", () => {
    renderHome();
    const imgs = [...document.querySelectorAll("main img")];
    expect(imgs.length).toBeGreaterThan(4);
    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("fetchpriority")).toBeNull();
      expect(img.getAttribute("alt")).toBeTruthy();
    }
  });
});
