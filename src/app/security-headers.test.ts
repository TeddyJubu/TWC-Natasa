import { describe, expect, it } from "vitest";
import { csrfMiddleware, startInstance } from "../start";
import { SECURITY_HEADERS, contentSecurityPolicy, securityHeadersMiddleware, withSecurityHeaders } from "./security-headers";

// The middleware objects keep their server function on `options.server`; call it the way Start does.
type ServerFn = (opts: Record<string, unknown>) => Promise<unknown> | unknown;
const serverOf = (m: unknown) => (m as { options: { server: ServerFn } }).options.server;
const run = (m: unknown, request: Request, handlerType: "router" | "serverFn", response = new Response("ok")) =>
  serverOf(m)({
    request,
    pathname: new URL(request.url).pathname,
    context: {},
    handlerType,
    next: async () => ({ request, pathname: "/", context: {}, response }),
  }) as Promise<{ response: Response } | Response>;
const responseOf = (r: { response: Response } | Response) => (r instanceof Response ? r : r.response);

describe("content security policy", () => {
  const supabase = "https://abcdefgh.supabase.co";

  it("is the full enforced policy, with the Supabase origin for images, fetches and realtime", () => {
    expect(contentSecurityPolicy(supabase)).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https://abcdefgh.supabase.co; " +
        "connect-src 'self' https://abcdefgh.supabase.co wss://abcdefgh.supabase.co; font-src 'self'; " +
        "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
  });

  it("uses only the origin of the Supabase URL", () => {
    expect(contentSecurityPolicy("https://abcdefgh.supabase.co/rest/v1/")).toContain("connect-src 'self' https://abcdefgh.supabase.co wss://abcdefgh.supabase.co;");
    expect(contentSecurityPolicy("http://127.0.0.1:54321")).toContain("connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321;");
  });

  it("falls back to same-origin only without a valid Supabase URL, never a wildcard", () => {
    for (const bad of [undefined, "", "not a url", "javascript:alert(1)"]) {
      const csp = contentSecurityPolicy(bad);
      expect(csp).toContain("connect-src 'self';");
      expect(csp).toContain("img-src 'self' data: blob:;");
      expect(csp).not.toMatch(/\*|undefined/);
    }
  });

  it("is what SECURITY_HEADERS sends, built from VITE_SUPABASE_URL", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toBe(contentSecurityPolicy(import.meta.env.VITE_SUPABASE_URL));
    expect(SECURITY_HEADERS["Content-Security-Policy"]).not.toMatch(/lovable|gptengineer/);
  });
});

describe("security headers", () => {
  it("are the CSP plus the headers that can't break the site", () => {
    expect(Object.keys(SECURITY_HEADERS)).toEqual([
      "Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy",
    ]);
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  });

  it("are added to page responses by the middleware", async () => {
    const res = responseOf(await run(securityHeadersMiddleware, new Request("https://example.com/"), "router"));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(name)).toBe(value);
    expect(await res.text()).toBe("ok");
  });

  it("keep a header a route already set", () => {
    const res = withSecurityHeaders(new Response("", { headers: { "Referrer-Policy": "no-referrer" } }));
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("work on responses with immutable headers (Response.redirect)", () => {
    const res = withSecurityHeaders(Response.redirect("https://example.com/auth", 302));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/auth");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("start instance", () => {
  it("registers the headers middleware first and keeps Start's CSRF check for server functions", async () => {
    const { requestMiddleware } = await startInstance.getOptions();
    expect(requestMiddleware).toEqual([securityHeadersMiddleware, csrfMiddleware]);
  });

  it("CSRF middleware rejects a cross-site server-function call and ignores page requests", async () => {
    const crossSite = () =>
      new Request("https://example.com/_serverFn/abc", {
        method: "POST",
        headers: { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" },
      });
    expect(responseOf(await run(csrfMiddleware, crossSite(), "serverFn")).status).toBe(403);
    expect(responseOf(await run(csrfMiddleware, crossSite(), "router")).status).toBe(200);
  });
});
