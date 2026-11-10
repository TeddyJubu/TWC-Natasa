import { createMiddleware } from "@tanstack/react-start";

/**
 * The enforced CSP. Everything the app loads or fetches is same-origin: pages, server functions, /api/auth and
 * /media images, except the public form page's doop design-sync script, which also posts its capture to
 * `https://doop.design`. 'unsafe-inline' scripts and styles: SSR hydration emits inline scripts and components set
 * inline `style` (e.g. `--hood`); per-request nonces would replace it. A new external origin goes here, with a test.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://doop.design",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // OpenFreeMap: the /account neighborhood map's style, vector tiles, glyphs and sprites (NeighborhoodMap.tsx).
    "connect-src 'self' https://doop.design https://tiles.openfreemap.org",
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
} as const;

/** Adds any security header the response doesn't already set. */
export function withSecurityHeaders(response: Response): Response {
  const apply = (headers: Headers) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) if (!headers.has(name)) headers.set(name, value);
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

/** Request middleware: every page and server-function response Start produces gets the headers. */
export const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  return { ...result, response: withSecurityHeaders(result.response) };
});
