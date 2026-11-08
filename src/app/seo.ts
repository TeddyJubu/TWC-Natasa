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
// public/sitemap.xml lists the same paths (src/app/sitemap.test.ts keeps them in step).
export const INDEXED = new Set(["/", "/members", "/join", "/auth", "/privacy", "/terms", "/code-of-conduct"]);

const absolute = (site: string, path: string) => site + (path.startsWith("/") ? path : `/${path}`);

/** Canonical link, og:url and og:image tags; empty when the site URL is missing or invalid. */
export function siteSeo(rawSiteUrl: string | undefined, pathname: string | undefined, image: string) {
  const meta: { property: string; content: string }[] = [];
  const links: { rel: string; href: string }[] = [];
  const site = parseSiteUrl(rawSiteUrl);
  if (!site) return { meta, links };
  if (pathname && INDEXED.has(pathname)) {
    const url = absolute(site, pathname);
    links.push({ rel: "canonical", href: url });
    meta.push({ property: "og:url", content: url });
  }
  // A root-relative asset path is resolved against the site; an inlined (data:) or relative asset is skipped.
  const imageUrl = /^https?:\/\//i.test(image) ? image : image.startsWith("/") && !image.startsWith("//") ? absolute(site, image) : undefined;
  if (imageUrl) meta.push({ property: "og:image", content: imageUrl });
  return { meta, links };
}
