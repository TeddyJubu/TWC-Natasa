// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);

import { getRouter } from "@/router";
import { ErrorPage, NotFound } from "@/app/layout/StatusPages";

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

/** Loads `path` in a real router and returns the root match's computed head tags. */
async function rootHeadAt(path: string) {
  window.history.replaceState(null, "", path);
  const router = getRouter();
  await router.load();
  const root = router.state.matches[0] as unknown as { links?: { rel?: string; href?: string }[]; meta?: { property?: string; content?: string }[] };
  return { links: root.links ?? [], meta: root.meta ?? [] };
}

describe("getRouter", () => {
  it("uses the site's 404 and error pages as defaults", () => {
    const router = getRouter();
    expect(router.options.defaultNotFoundComponent).toBe(NotFound);
    expect(router.options.defaultErrorComponent).toBe(ErrorPage);
  });

  it("a real 404 gets no canonical or og:url, while a real page does", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com");
    const page = await rootHeadAt("/join");
    expect(page.links.find((l) => l.rel === "canonical")?.href).toBe("https://example.com/join");
    const missing = await rootHeadAt("/no-such-page");
    expect(missing.links.find((l) => l.rel === "canonical")).toBeUndefined();
    expect(missing.meta.find((m) => m.property === "og:url")).toBeUndefined();
  });
});
