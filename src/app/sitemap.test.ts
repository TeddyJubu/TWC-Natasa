import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDEXED } from "./seo";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("public/sitemap.xml", () => {
  it("lists exactly the indexable public routes, as absolute URLs on the app's domain", () => {
    const locs = [...read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([...INDEXED].map((p) => `https://new.thewomenscollective.club${p}`));
  });

  it("is announced in robots.txt", () => {
    expect(read("public/robots.txt")).toMatch(/^Sitemap: https:\/\/new\.thewomenscollective\.club\/sitemap\.xml$/m);
  });

  it("matches VITE_SITE_URL in the tracked .env", () => {
    expect(read(".env")).toMatch(/^VITE_SITE_URL=https:\/\/new\.thewomenscollective\.club$/m);
  });
});
