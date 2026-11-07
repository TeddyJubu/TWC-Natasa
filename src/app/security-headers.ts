import { createMiddleware } from "@tanstack/react-start";

/**
 * Response headers that can't break the site. The CSP sets only `frame-ancestors`, so the Lovable editor
 * can still frame the site. A full script/style CSP needs per-request nonces for SSR hydration and is an
 * owner follow-up (AUDIT-TASKS.md, Owner decisions).
 */
export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://*.lovableproject.com https://*.gptengineer.app",
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
