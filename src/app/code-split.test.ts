import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

// Keeps heavy code out of the chunks every page loads.
describe("CircularGallery code split (OGL + the WebGL engine load only with a moving CurvedGallery)", () => {
  it("content.tsx loads ./circular-gallery only through a dynamic import", () => {
    const src = read("../design-system/components/content.tsx");
    expect(src).not.toMatch(/^\s*import\s[^;]*from\s+["']\.\/circular-gallery["']/m);
    expect(src).toMatch(/import\(\s*["']\.\/circular-gallery["']\s*\)/);
  });

  it("circular-gallery.tsx does not import ../lib/utils (it would drag tailwind-merge into the lazy chunk)", () => {
    expect(read("../design-system/components/circular-gallery.tsx")).not.toMatch(/from\s+["']\.\.\/lib\/utils["']/);
  });

  it("the barrel re-exports circular-gallery as types only", () => {
    const lines = read("../index.ts").split("\n").filter((l) => l.includes("circular-gallery"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines.filter((l) => !l.trim().startsWith("//"))) expect(line).toMatch(/^export type /);
  });
});
