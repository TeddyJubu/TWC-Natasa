import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = ["src/routes/members.tsx", "src/routes/_authenticated/account.tsx"];
const read = (p: string) => readFileSync(p, "utf8");

describe("Step 5 rules", () => {
  it.each(routes)("%s does not import the Supabase client or src/lib/account", (p) => {
    expect(read(p)).not.toMatch(/@\/integrations\/supabase\/client|@\/lib\/account/);
  });

  it("src/lib/account.ts is gone", () => {
    expect(existsSync("src/lib/account.ts")).toBe(false);
  });

  it.each(routes)("%s has no hard-coded neighborhood color classes or lists", (p) => {
    const src = read(p);
    expect(src).not.toMatch(/\b(?:bg|text)-(?:lic|astoria|sunnyside|jackson-heights|elmhurst|forest-hills|rego-park)\b/);
    expect(src).not.toMatch(/\b(?:wash|ink|neighborhoodFill)\s*:\s*Record</);
    expect(src).not.toContain('"Long Island City"');
  });

  it.each(routes)("%s consumes neighborhood color via --hood", (p) => {
    expect(read(p)).toMatch(/(?:bg|text)-\(--hood\)/);
  });

  it(".dsignore excludes design-system tests from attach", () => {
    expect(read(".dsignore").split("\n").map((l) => l.trim())).toContain("src/design-system/**/*.test.*");
  });
});
