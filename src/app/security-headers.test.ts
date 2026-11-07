import { describe, expect, it } from "vitest";
import { csrfMiddleware, startInstance } from "../start";
import { SECURITY_HEADERS, securityHeadersMiddleware, withSecurityHeaders } from "./security-headers";

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

describe("security headers", () => {
  it("are only ones that can't break the site", () => {
    expect(SECURITY_HEADERS).toEqual({
      "Content-Security-Policy":
        "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://*.lovableproject.com https://*.gptengineer.app",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    });
    // Lovable's editor frames the site: never deny framing outright.
    expect(Object.keys(SECURITY_HEADERS)).not.toContain("X-Frame-Options");
    expect(SECURITY_HEADERS["Content-Security-Policy"]).not.toMatch(/script-src|style-src|default-src/);
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
