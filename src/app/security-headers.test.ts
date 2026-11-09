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
  it("is the full enforced policy: same origin only, plus data:/blob: images", () => {
    expect(contentSecurityPolicy()).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; " +
        "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
  });

  it("is what SECURITY_HEADERS sends, with no third-party origin", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toBe(contentSecurityPolicy());
    expect(SECURITY_HEADERS["Content-Security-Policy"]).not.toMatch(/supabase|lovable|gptengineer|https?:|wss?:|\*/);
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

  it.each(["/api/images", "/api/neighborhood-logos", "/api/applications", "/api/contact", "/api/partnerships"])("CSRF middleware also guards the POST route %s", async (path) => {
    const crossSite = new Request(`https://example.com${path}`, {
      method: "POST", headers: { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" },
    });
    expect(responseOf(await run(csrfMiddleware, crossSite, "router")).status).toBe(403);
  });
});
