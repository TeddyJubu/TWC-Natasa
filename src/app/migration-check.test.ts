import { describe, expect, it } from "vitest";
import { KEEP_ON_APEX, OLD_TO_NEW, routeExists } from "../../scripts/migration-check.ts";

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

describe("migration-check old URL map", () => {
  it("points every old page at a route that exists, so a removed route can't hide behind manifest items", () => {
    for (const [page, path] of Object.entries(OLD_TO_NEW)) expect(routeExists(path), `${page} → ${path}`).toBe(true);
  });

  it("keeps the legal pages on the apex while the app has none", () => {
    for (const page of ["privacy.html", "terms.html", "code-of-conduct.html"]) {
      expect(KEEP_ON_APEX.has(page)).toBe(true);
      expect(OLD_TO_NEW[page]).toBeUndefined();
      expect(routeExists(`/${page.replace(".html", "")}`)).toBe(false);
    }
  });
});
