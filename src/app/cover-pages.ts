// The pages whose CSP allows a gathering's https cover image. Case-insensitive like the router.
const COVER_IMAGE_PAGES = /^\/(gatherings|embed\/gatherings|admin\/gatherings)(\/|$)/i;
export const showsCoverImages = (pathname: string) => COVER_IMAGE_PAGES.test(pathname);

/**
 * A CSP belongs to the document, so arriving here by client navigation from another page would keep that page's
 * `img-src` and block every cover. In that case load this page for real; a preload (link hover) never does.
 */
export function ensureCoverPolicy(href: string, preload?: boolean): Promise<never> | undefined {
  if (typeof window === "undefined" || preload) return undefined;
  const entry = performance.getEntriesByType?.("navigation")[0];
  if (!entry || showsCoverImages(new URL(entry.name).pathname)) return undefined;
  window.location.assign(href);
  return new Promise<never>(() => undefined); // the page is being replaced
}
