import { createMiddleware } from "@tanstack/react-start";

/** The http(s) origin of a URL, or undefined (missing, malformed or another scheme). */
function httpOrigin(raw: string | undefined): string | undefined {
  try {
    const url = new URL(raw ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The enforced CSP. The browser talks to Supabase directly (REST, auth, storage; realtime over ws), and
 * portraits are signed Supabase Storage URLs. 'unsafe-inline' scripts and styles: SSR hydration emits
 * inline scripts and components set inline `style` (e.g. `--hood`); per-request nonces would replace it.
 * ponytail: one Supabase origin; add others here only when the app really fetches from them.
 */
export function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  const supabase = httpOrigin(supabaseUrl);
  const realtime = supabase?.replace(/^http/, "ws");
  const list = (...sources: (string | undefined)[]) => sources.filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${list("'self'", "data:", "blob:", supabase)}`,
    `connect-src ${list("'self'", supabase, realtime)}`,
    "font-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export const SECURITY_HEADERS = {
  "Content-Security-Policy": contentSecurityPolicy(import.meta.env.VITE_SUPABASE_URL),
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
