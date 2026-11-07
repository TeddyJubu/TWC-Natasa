import { describe, expect, it } from "vitest";
import { currentPathname, parseSiteUrl, siteSeo } from "@/app/seo";

describe("parseSiteUrl", () => {
  it("accepts an absolute http(s) URL", () => {
    expect(parseSiteUrl("https://thewomenscollective.nyc")).toBe("https://thewomenscollective.nyc");
    expect(parseSiteUrl("http://localhost:8080")).toBe("http://localhost:8080");
  });

  it("strips trailing slashes", () => {
    expect(parseSiteUrl("https://example.com/")).toBe("https://example.com");
    expect(parseSiteUrl("https://example.com///")).toBe("https://example.com");
  });

  it("rejects anything that is not an absolute http(s) URL", () => {
    for (const bad of [
      "example.com", "/members", "//example.com", "ftp://example.com", "javascript:alert(1)",
      "https:example.com", "https://", "not a url", "https://example.com/?ref=x", "https://example.com/#top",
      "https://user:pass@example.com",
      // Assets are served from the origin root, so a sub-path would give wrong og:image URLs.
      "https://example.com/collective", "https://example.com/collective/",
    ]) {
      expect(parseSiteUrl(bad), bad).toBeUndefined();
    }
  });

  it("treats a missing or blank value as unset", () => {
    expect(parseSiteUrl(undefined)).toBeUndefined();
    expect(parseSiteUrl("")).toBeUndefined();
    expect(parseSiteUrl("   ")).toBeUndefined();
  });
});

describe("currentPathname", () => {
  it("is the deepest match's pathname", () => {
    expect(currentPathname([{ pathname: "/" }, { pathname: "/members" }])).toBe("/members");
  });

  it("is undefined with no matches or on a not-found page", () => {
    expect(currentPathname([])).toBeUndefined();
    expect(currentPathname([{ pathname: "/", _notFound: true }])).toBeUndefined();
    expect(currentPathname([{ pathname: "/" }, { pathname: "/x", status: "notFound" }])).toBeUndefined();
    expect(currentPathname([{ pathname: "/" }, { pathname: "/members", status: "error" }])).toBeUndefined();
  });
});

describe("siteSeo", () => {
  const image = "/assets/hero-abc123.jpg";

  it("emits absolute canonical, og:url and og:image for a valid site URL", () => {
    const { meta, links } = siteSeo("https://example.com/", "/members", image);
    expect(links).toEqual([{ rel: "canonical", href: "https://example.com/members" }]);
    expect(meta).toEqual([
      { property: "og:url", content: "https://example.com/members" },
      { property: "og:image", content: "https://example.com/assets/hero-abc123.jpg" },
    ]);
  });

  it("gives canonical and og:url only to indexable public pages", () => {
    for (const path of ["/", "/members", "/join", "/auth"]) {
      expect(siteSeo("https://example.com", path, image).links, path).toHaveLength(1);
    }
    // noindex, members-only, one-off and preview pages: no self-referential canonical (og:image stays).
    for (const path of ["/colors", "/typography", "/components", "/admin", "/account", "/reset-password", "/__mockup/preview/x", "/__component/preview/x"]) {
      const { meta, links } = siteSeo("https://example.com", path, image);
      expect(links, path).toEqual([]);
      expect(meta, path).toEqual([{ property: "og:image", content: "https://example.com/assets/hero-abc123.jpg" }]);
    }
  });

  it("keeps the home page at the site root", () => {
    expect(siteSeo("https://example.com", "/", image).links).toEqual([{ rel: "canonical", href: "https://example.com/" }]);
  });

  it("emits nothing when the site URL is missing or invalid", () => {
    expect(siteSeo(undefined, "/members", image)).toEqual({ meta: [], links: [] });
    expect(siteSeo("example.com", "/members", image)).toEqual({ meta: [], links: [] });
  });

  it("omits canonical and og:url without a current path", () => {
    expect(siteSeo("https://example.com", undefined, image)).toEqual({
      meta: [{ property: "og:image", content: "https://example.com/assets/hero-abc123.jpg" }],
      links: [],
    });
  });

  it("keeps an already-absolute image and never emits a relative or inlined one", () => {
    expect(siteSeo("https://example.com", undefined, "https://cdn.example.net/hero.jpg").meta)
      .toEqual([{ property: "og:image", content: "https://cdn.example.net/hero.jpg" }]);
    expect(siteSeo("https://example.com", undefined, "data:image/jpeg;base64,AAAA").meta).toEqual([]);
    expect(siteSeo("https://example.com", undefined, "assets/hero.jpg").meta).toEqual([]);
  });
});
