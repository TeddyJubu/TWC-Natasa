import { createMiddleware } from "@tanstack/react-start";
import { DOOP_ORIGIN, doopSyncOn } from "./doop-sync";

/**
 * The enforced CSP. Everything the app loads or fetches is same-origin: pages, server functions, /api/auth and
 * /media images, except the map's tiles and, only in a VITE_DOOP_SYNC=true build, the /f/<slug> design-sync script,
 * which also posts its capture to `https://doop.design`. 'unsafe-inline' scripts and styles: SSR hydration emits inline scripts and components set
 * inline `style` (e.g. `--hood`); per-request nonces would replace it. A new external origin goes here, with a test.
 */
export function contentSecurityPolicy({ doop = doopSyncOn() }: { doop?: boolean } = {}): string {
  const sync = doop ? ` ${DOOP_ORIGIN}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${sync}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // OpenFreeMap: the /account neighborhood map's style, vector tiles, glyphs and sprites (NeighborhoodMap.tsx).
    `connect-src 'self'${sync} https://tiles.openfreemap.org`,
    "font-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export const SECURITY_HEADERS = {
  "Content-Security-Policy": contentSecurityPolicy(),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  // A year of https-only, subdomains too; no preload. Browsers ignore it over plain http, so local dev is unaffected.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;

/** Adds any of `extra` the response doesn't already set. */
function addHeaders(response: Response, extra: Record<string, string>): Response {
  const apply = (headers: Headers) => {
    for (const [name, value] of Object.entries(extra)) if (!headers.has(name)) headers.set(name, value);
  };
  try {
    apply(response.headers);
    return response;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    // Immutable headers (e.g. Response.redirect): copy the response, then add them.
    const copy = new Response(response.body, response);
    apply(copy.headers);
    return copy;
  }
}

/** Adds any security header the response doesn't already set. */
export function withSecurityHeaders(response: Response): Response {
  return addHeaders(response, SECURITY_HEADERS);
}

// The signed-in pages render client-side only (`_authenticated` is ssr: false), so their own robots meta never
// reaches a crawler; the header does. Not a robots.txt Disallow, which would hide this header from Google.
const SIGNED_IN_PAGES = /^\/(account|directory|feed|admin)(\/|$)/;
export const isSignedInPage = (pathname: string) => SIGNED_IN_PAGES.test(pathname);

/** Request middleware: every page and server-function response Start produces gets the headers. */
export const securityHeadersMiddleware = createMiddleware().server(async ({ pathname, next }) => {
  const result = await next();
  const response = withSecurityHeaders(result.response);
  return { ...result, response: isSignedInPage(pathname) ? addHeaders(response, { "X-Robots-Tag": "noindex" }) : response };
});
