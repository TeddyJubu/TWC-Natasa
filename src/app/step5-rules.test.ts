import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = ["src/routes/members.tsx", "src/routes/_authenticated/account.tsx"];
const read = (p: string) => readFileSync(p, "utf8");
// The account page's sections live in src/features/account/ (Phase 7 split), so its source is the route plus them.
const pageSource = (p: string) =>
  p.endsWith("/account.tsx")
    ? [p, ...readdirSync("src/features/account").filter((f) => /\.tsx?$/.test(f)).map((f) => `src/features/account/${f}`)].map(read).join("\n")
    : read(p);

describe("Step 5 rules", () => {
  it.each(routes)("%s does not import the Supabase client or src/lib/account", (p) => {
    expect(pageSource(p)).not.toMatch(/@\/integrations\/supabase\/client|@\/lib\/account/);
  });

  it("src/lib/account.ts is gone", () => {
    expect(existsSync("src/lib/account.ts")).toBe(false);
  });

  it.each(routes)("%s has no hard-coded neighborhood color classes or lists", (p) => {
    const src = pageSource(p);
    expect(src).not.toMatch(/\b(?:bg|text)-(?:lic|astoria|sunnyside|jackson-heights|elmhurst|forest-hills|rego-park)\b/);
    expect(src).not.toMatch(/\b(?:wash|ink|neighborhoodFill)\s*:\s*Record</);
    expect(src).not.toContain('"Long Island City"');
  });

  it.each(routes)("%s consumes neighborhood color via --hood", (p) => {
    expect(pageSource(p)).toMatch(/(?:bg|text)-\(--hood\)/);
  });

  it(".dsignore excludes design-system tests from attach", () => {
    expect(read(".dsignore").split("\n").map((l) => l.trim())).toContain("src/design-system/**/*.test.*");
  });
});
