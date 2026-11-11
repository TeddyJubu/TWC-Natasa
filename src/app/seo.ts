// Absolute-URL SEO tags (canonical, og:url, og:image) from an optional site URL.
// Pure: every function returns nothing rather than a relative or guessed absolute URL.

/**
 * The site's origin (absolute http(s), no path), or undefined if missing or invalid. Assets are served
 * from the origin root and the router has no basepath, so a sub-path would produce wrong URLs.
 */
export function parseSiteUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value || !/^https?:\/\/[^/]/i.test(value)) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.search || url.hash || url.username || url.password || !url.hostname) return undefined;
  if (url.pathname.replace(/\/+$/, "") !== "") return undefined;
  return url.origin;
}

type HeadMatch = { pathname: string; status?: string; _notFound?: boolean };

/** The current route's pathname from the head context's matches; undefined on a not-found or error page. */
export function currentPathname(matches: readonly HeadMatch[]): string | undefined {
  if (matches.some((m) => m._notFound || m.status === "notFound" || m.status === "error")) return undefined;
  return matches.at(-1)?.pathname;
}

// ponytail: allow-list, so a new public page only lacks a canonical until it's added here — never gets a
// wrong one. noindex (showcase, /admin), members-only (/account), one-off and preview pages stay out.
// /sitemap.xml (src/server/sitemap.ts) lists these plus active neighborhoods and public member pages.
export const INDEXED = new Set([
  "/", "/about", "/members", "/gatherings", "/neighborhoods", "/faq", "/fellowship", "/partnerships", "/contact", "/join", "/auth",
]);

const absolute = (site: string, path: string) => site + (path.startsWith("/") ? path : `/${path}`);

/** The share card: public/og-image.jpg, a 1200x630 crop of the home hero (hero-rock.webp), at a stable URL. */
export const OG_IMAGE = {
  src: "/og-image.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "A woman in sunglasses sitting on a sunlit rock beneath a wide blue sky",
};
export type OgImage = typeof OG_IMAGE;

/** Canonical link and og:url for one path; empty when the site URL is missing or invalid. For pages outside INDEXED. */
export function canonicalTags(rawSiteUrl: string | undefined, path: string) {
  const site = parseSiteUrl(rawSiteUrl);
  if (!site) return { meta: [] as { property: string; content: string }[], links: [] as { rel: string; href: string }[] };
  const url = absolute(site, path);
  return { meta: [{ property: "og:url", content: url }], links: [{ rel: "canonical", href: url }] };
}

/** Canonical link, og:url and og:image tags; empty when the site URL is missing or invalid. */
export function siteSeo(rawSiteUrl: string | undefined, pathname: string | undefined, image: OgImage) {
  const meta: ({ property: string; content: string } | { name: string; content: string })[] = [];
  const links: { rel: string; href: string }[] = [];
  const site = parseSiteUrl(rawSiteUrl);
  if (!site) return { meta, links };
  if (pathname && INDEXED.has(pathname)) {
    const url = absolute(site, pathname);
    links.push({ rel: "canonical", href: url });
    meta.push({ property: "og:url", content: url });
  }
  // A root-relative asset path is resolved against the site; an inlined (data:) or relative asset is skipped.
  const src = image.src;
  const imageUrl = /^https?:\/\//i.test(src) ? src : src.startsWith("/") && !src.startsWith("//") ? absolute(site, src) : undefined;
  if (imageUrl) {
    meta.push(
      { property: "og:image", content: imageUrl },
      { property: "og:image:width", content: String(image.width) },
      { property: "og:image:height", content: String(image.height) },
      { property: "og:image:type", content: image.type },
      { property: "og:image:alt", content: image.alt },
      { name: "twitter:image:alt", content: image.alt },
    );
  }
  return { meta, links };
}

/** A JSON-LD head script. `<` is escaped so a database string can never close the script element. */
export function jsonLdScript(data: unknown) {
  return { type: "application/ld+json", children: JSON.stringify(data).replace(/</g, "\\u003c") };
}

/** A BreadcrumbList of absolute URLs, from the home page down. */
export function breadcrumbLd(site: string, trail: readonly (readonly [name: string, path: string])[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absolute(site, path) })),
  };
}

/**
 * The collective as an Organization: only facts the site states (its name, the home description, Western Queens,
 * its founder, the constellation star). No sameAs: the site links no social profiles.
 */
export function organizationLd(site: string) {
  return {
    "@type": "Organization",
    "@id": `${site}/#organization`,
    name: "The Women’s Collective",
    url: `${site}/`,
    logo: `${site}/apple-touch-icon.png`,
    description: "A community for women building businesses, careers, creative work, and real relationships close to home in Western Queens.",
    areaServed: { "@type": "Place", name: "Western Queens, New York" },
    founder: { "@type": "Person", name: "Nataša Tuohy" },
  };
}
