import { describe, expect, it, vi } from "vitest";
import { csrfMiddleware, startInstance } from "../start";
import { SECURITY_HEADERS, contentSecurityPolicy, createNonce, isSignedInPage, securityHeadersMiddleware, withSecurityHeaders } from "./security-headers";

// The middleware objects keep their server function on `options.server`; call it the way Start does.
type ServerFn = (opts: Record<string, unknown>) => Promise<unknown> | unknown;
const serverOf = (m: unknown) => (m as { options: { server: ServerFn } }).options.server;
const run = (m: unknown, request: Request, handlerType: "router" | "serverFn", response = new Response("ok"), seen: unknown[] = []) =>
  serverOf(m)({
    request,
    pathname: new URL(request.url).pathname,
    context: {},
    handlerType,
    next: async (opts?: unknown) => (seen.push(opts), { request, pathname: "/", context: {}, response }),
  }) as Promise<{ response: Response } | Response>;
const responseOf = (r: { response: Response } | Response) => (r instanceof Response ? r : r.response);

describe("content security policy", () => {
  it("is the full enforced policy: same origin, no inline scripts, data:/blob: images and the map tiles", () => {
    expect(contentSecurityPolicy()).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; connect-src 'self' https://tiles.openfreemap.org; font-src 'self'; " +
        "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
  });

  it("allows the doop design-sync host only in a VITE_DOOP_SYNC=true build", () => {
    for (const value of [undefined, "", "false", "1", "TRUE"]) {
      vi.stubEnv("VITE_DOOP_SYNC", value as string);
      expect(contentSecurityPolicy(), String(value)).not.toContain("doop.design");
    }
    vi.stubEnv("VITE_DOOP_SYNC", "true");
    const csp = contentSecurityPolicy();
    expect(csp).toMatch(/script-src 'self' https:\/\/doop\.design;/);
    expect(contentSecurityPolicy({ nonce: "abc" })).toMatch(/script-src 'self' 'nonce-abc' https:\/\/doop\.design;/);
    expect(csp).toMatch(/connect-src 'self' https:\/\/doop\.design https:\/\/tiles\.openfreemap\.org;/);
    vi.unstubAllEnvs();
  });

  it("lets inline scripts run only with the page's nonce, or on the dev server", () => {
    expect(contentSecurityPolicy({ nonce: "abc" })).toMatch(/script-src 'self' 'nonce-abc';/);
    // A nonce wins: 'unsafe-inline' would be ignored next to it anyway.
    expect(contentSecurityPolicy({ nonce: "abc", inline: true })).toMatch(/script-src 'self' 'nonce-abc';/);
    expect(contentSecurityPolicy({ inline: true })).toMatch(/script-src 'self' 'unsafe-inline';/);
    // Styles keep 'unsafe-inline' (inline `style` attributes), with or without a script nonce.
    expect(contentSecurityPolicy({ nonce: "abc" })).toMatch(/style-src 'self' 'unsafe-inline';/);
  });

  it("makes a fresh 128-bit base64 nonce each time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const n of nonces) expect(atob(n)).toHaveLength(16);
  });

  it("is what SECURITY_HEADERS sends; the map's tile host is the only third-party origin", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toBe(contentSecurityPolicy());
    // Tiles are fetched, never scripted: the map's host is in connect-src only.
    expect(csp).toMatch(/connect-src [^;]*https:\/\/tiles\.openfreemap\.org/);
    expect(csp).not.toMatch(/script-src [^;]*openfreemap/);
    expect(csp).not.toMatch(/supabase|lovable|gptengineer|wss?:|\*|http:\/\//);
    expect(csp.match(/https:\/\/[^;\s]+/g)).toEqual(["https://tiles.openfreemap.org"]);
  });
});

describe("security headers", () => {
  it("are the CSP plus the headers that can't break the site", () => {
    expect(Object.keys(SECURITY_HEADERS)).toEqual([
      "Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security",
    ]);
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  });

  it("are added to page responses by the middleware, each page with its own nonce passed on to the router", async () => {
    vi.stubEnv("DEV", false);
    try {
      const seen: unknown[] = [];
      const page = async () => responseOf(await run(securityHeadersMiddleware, new Request("https://example.com/"), "router", new Response("ok"), seen));
      const [a, b] = [await page(), await page()];
      const nonces = seen.map((opts) => (opts as { context: { nonce: string } }).context.nonce);
      expect(nonces[0]).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(nonces[1]).not.toBe(nonces[0]);
      expect(a.headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy({ nonce: nonces[0] }));
      expect(b.headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy({ nonce: nonces[1] }));
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) if (name !== "Content-Security-Policy") expect(a.headers.get(name)).toBe(value);
      expect(await a.text()).toBe("ok");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("give server-function responses the nonce-less policy, and the dev server's pages 'unsafe-inline'", async () => {
    const seen: unknown[] = [];
    vi.stubEnv("DEV", false);
    const fn = responseOf(await run(securityHeadersMiddleware, new Request("https://example.com/_serverFn/x"), "serverFn", new Response("ok"), seen));
    expect(fn.headers.get("Content-Security-Policy")).toBe(SECURITY_HEADERS["Content-Security-Policy"]);
    vi.stubEnv("DEV", true);
    const dev = responseOf(await run(securityHeadersMiddleware, new Request("https://example.com/"), "router", new Response("ok"), seen));
    expect(dev.headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy({ inline: true }));
    expect(seen).toEqual([{ context: { nonce: undefined } }, { context: { nonce: undefined } }]);
    vi.unstubAllEnvs();
  });

  it("mark the client-rendered signed-in pages noindex, and no public page", async () => {
    for (const path of ["/account", "/directory", "/feed", "/admin", "/admin/forms", "/admin/forms/application", "/Account", "/ADMIN/forms"]) {
      expect(isSignedInPage(path), path).toBe(true);
      const res = responseOf(await run(securityHeadersMiddleware, new Request(`https://example.com${path}`), "router"));
      expect(res.headers.get("X-Robots-Tag"), path).toBe("noindex");
    }
    for (const path of ["/", "/members", "/members/rosa-diaz-12", "/administer", "/feeds", "/accounts", "/faq"]) {
      expect(isSignedInPage(path), path).toBe(false);
      const res = responseOf(await run(securityHeadersMiddleware, new Request(`https://example.com${path}`), "router"));
      expect(res.headers.get("X-Robots-Tag"), path).toBeNull();
    }
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

  it.each(["/api/images", "/api/feed", "/api/neighborhood-logos", "/api/applications", "/api/contact", "/api/partnerships", "/api/review", "/api/spotlight", "/api/forms/salon-rsvp"])("CSRF middleware also guards the POST route %s", async (path) => {
    const crossSite = new Request(`https://example.com${path}`, {
      method: "POST", headers: { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" },
    });
    expect(responseOf(await run(csrfMiddleware, crossSite, "router")).status).toBe(403);
  });
});
