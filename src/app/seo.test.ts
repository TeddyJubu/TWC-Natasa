import { describe, expect, it } from "vitest";
import { OG_IMAGE, canonicalTags, currentPathname, parseSiteUrl, siteSeo } from "@/app/seo";

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
  const image = { ...OG_IMAGE, src: "/og-image.jpg" };
  const imageMeta = (url: string) => [
    { property: "og:image", content: url },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/jpeg" },
    { property: "og:image:alt", content: OG_IMAGE.alt },
    { name: "twitter:image:alt", content: OG_IMAGE.alt },
  ];

  it("emits absolute canonical, og:url and og:image with its size, type and alt for a valid site URL", () => {
    const { meta, links } = siteSeo("https://example.com/", "/members", image);
    expect(links).toEqual([{ rel: "canonical", href: "https://example.com/members" }]);
    expect(meta).toEqual([{ property: "og:url", content: "https://example.com/members" }, ...imageMeta("https://example.com/og-image.jpg")]);
  });

  it("gives canonical and og:url only to indexable public pages", () => {
    for (const path of ["/", "/members", "/join", "/auth"]) {
      expect(siteSeo("https://example.com", path, image).links, path).toHaveLength(1);
    }
    // noindex, members-only, one-off and preview pages: no self-referential canonical (og:image stays).
    for (const path of ["/colors", "/typography", "/components", "/admin", "/account", "/reset-password"]) {
      const { meta, links } = siteSeo("https://example.com", path, image);
      expect(links, path).toEqual([]);
      expect(meta, path).toEqual(imageMeta("https://example.com/og-image.jpg"));
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
    expect(siteSeo("https://example.com", undefined, image)).toEqual({ meta: imageMeta("https://example.com/og-image.jpg"), links: [] });
  });

  it("keeps an already-absolute image and never emits a relative or inlined one, nor its size or alt", () => {
    expect(siteSeo("https://example.com", undefined, { ...image, src: "https://cdn.example.net/og.jpg" }).meta)
      .toEqual(imageMeta("https://cdn.example.net/og.jpg"));
    expect(siteSeo("https://example.com", undefined, { ...image, src: "data:image/jpeg;base64,AAAA" }).meta).toEqual([]);
    expect(siteSeo("https://example.com", undefined, { ...image, src: "assets/og.jpg" }).meta).toEqual([]);
  });

  it("points at a 1200x630 file that exists in public/", async () => {
    const { readFileSync } = await import("node:fs");
    const jpg = readFileSync(new URL("../../public/og-image.jpg", import.meta.url));
    // JPEG SOF0/SOF2 frame header: height then width, big-endian.
    let i = 2;
    while (i < jpg.length && !(jpg[i] === 0xff && (jpg[i + 1] === 0xc0 || jpg[i + 1] === 0xc2))) i += 2 + jpg.readUInt16BE(i + 2);
    expect([jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]).toEqual([OG_IMAGE.width, OG_IMAGE.height]);
  });
});

describe("canonicalTags", () => {
  it("is an absolute canonical and og:url for any path", () => {
    expect(canonicalTags("https://example.com/", "/neighborhoods/astoria")).toEqual({
      meta: [{ property: "og:url", content: "https://example.com/neighborhoods/astoria" }],
      links: [{ rel: "canonical", href: "https://example.com/neighborhoods/astoria" }],
    });
  });

  it("is empty without a valid site URL", () => {
    expect(canonicalTags(undefined, "/members/rosa-diaz-12")).toEqual({ meta: [], links: [] });
    expect(canonicalTags("example.com", "/members/rosa-diaz-12")).toEqual({ meta: [], links: [] });
  });
});
