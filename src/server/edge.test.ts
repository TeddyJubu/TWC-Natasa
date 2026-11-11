// server.mjs's edge helpers (edge.ts): the permanent trailing-slash redirect, immutable caching for hashed assets only,
// and gzip for the app's own HTML/JSON/XML when the client takes it.
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { IMMUTABLE, acceptsGzip, compressResponse, trailingSlashRedirect, withAssetCaching, withTextCharset } from "./edge";

const req = (path: string, init: RequestInit = {}) => new Request(`http://club.test${path}`, init);

describe("trailingSlashRedirect", () => {
  it("answers a page path with a trailing slash with a 308 to the path without it, query kept", () => {
    const res = trailingSlashRedirect(req("/about/?x=1"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("Location")).toBe("/about?x=1");
    expect(trailingSlashRedirect(req("/members/ada-1//"))?.headers.get("Location")).toBe("/members/ada-1");
    expect(trailingSlashRedirect(req("/faq/", { method: "HEAD" }))?.status).toBe(308);
  });

  it("leaves the root, slash-less paths, other methods, /api, /media and protocol-relative paths alone", () => {
    for (const path of ["/", "/about", "/api/auth/", "/media/avatars/", "/api/", "//evil.test/", "///"]) {
      expect(trailingSlashRedirect(req(path))).toBeNull();
    }
    expect(trailingSlashRedirect(req("/about/", { method: "POST" }))).toBeNull();
  });
});

describe("withAssetCaching", () => {
  it("marks found /assets/ files immutable for a year, over srvx's own max-age", () => {
    const ok = withAssetCaching("/assets/index-C16lSipR.js", new Response("x", { headers: { "Cache-Control": "max-age=0" } }));
    expect(ok.headers.get("Cache-Control")).toBe(IMMUTABLE);
    expect(withAssetCaching("/assets/a-1.css", new Response(null, { status: 304 })).headers.get("Cache-Control")).toBe(IMMUTABLE);
  });

  it("leaves un-hashed root files and missing assets alone", () => {
    for (const path of ["/favicon.png", "/robots.txt", "/og-image.jpg", "/about"]) {
      expect(withAssetCaching(path, new Response("x")).headers.get("Cache-Control")).toBeNull();
    }
    const missing = withAssetCaching("/assets/gone-abc.js", new Response("no", { status: 404, headers: { "Cache-Control": "no-store" } }));
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
  });

  it("works on a response whose headers are immutable", () => {
    const res = withAssetCaching("/assets/x-1.js", Response.redirect("http://club.test/assets/y-2.js", 301));
    expect(res.status).toBe(301);
    expect(withAssetCaching("/assets/x-1.js", Response.json({}, { status: 200 })).headers.get("Cache-Control")).toBe(IMMUTABLE);
  });
});

describe("acceptsGzip", () => {
  it.each([
    ["gzip, deflate, br", true],
    ["br;q=1.0, gzip;q=0.8", true],
    ["*", true],
    ["br", false],
    ["gzip;q=0", false],
    ["*;q=0.5, gzip;q=0", false],
    ["", false],
    [null, false],
  ])("%s -> %s", (header, expected) => expect(acceptsGzip(header)).toBe(expected));
});

describe("compressResponse", () => {
  const html = "<!doctype html><title>Hi</title>" + "<p>scrapbook</p>".repeat(200);
  const page = (headers: Record<string, string> = {}, body: string | null = html, status = 200) =>
    new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
  const gz = { headers: { "Accept-Encoding": "gzip, br" } };

  it("gzips HTML for a client that takes gzip, and the bytes round-trip", async () => {
    const res = compressResponse(req("/", gz), page({ "Content-Length": String(html.length), ETag: '"abc"', Vary: "Cookie" }));
    expect(res.headers.get("Content-Encoding")).toBe("gzip");
    expect(res.headers.get("Content-Length")).toBeNull();
    expect(res.headers.get("Vary")).toBe("Cookie, Accept-Encoding");
    expect(res.headers.get("ETag")).toBe('W/"abc"');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBeLessThan(html.length);
    expect(gunzipSync(bytes).toString()).toBe(html);
  });

  it("also gzips JSON and the sitemap's XML, keeping the status", async () => {
    const json = JSON.stringify({ rows: Array.from({ length: 200 }, (_, i) => ({ i })) });
    const res = compressResponse(req("/_serverFn/x", gz), new Response(json, { status: 404, headers: { "Content-Type": "application/json" } }));
    expect([res.status, res.headers.get("Content-Encoding")]).toEqual([404, "gzip"]);
    expect(gunzipSync(new Uint8Array(await res.arrayBuffer())).toString()).toBe(json);
    const xml = compressResponse(req("/sitemap.xml", gz), new Response("<urlset/>".repeat(200), { headers: { "Content-Type": "application/xml" } }));
    expect(xml.headers.get("Content-Encoding")).toBe("gzip");
  });

  it("leaves alone what can't or shouldn't be gzipped", () => {
    const cases: [Request, Response][] = [
      [req("/"), page()], // no Accept-Encoding
      [req("/", { headers: { "Accept-Encoding": "br" } }), page()],
      [req("/", { ...gz, method: "HEAD" }), page()],
      [req("/", gz), page({ "Content-Encoding": "br" })],
      [req("/", gz), page({ "Cache-Control": "no-transform" })],
      [req("/", gz), page({ "Content-Length": "100" }, "<p>small</p>")],
      [req("/", gz), page({}, null, 304)],
      [req("/", gz), new Response("x".repeat(5000), { headers: { "Content-Type": "image/png" } })],
      [req("/", gz), new Response("x".repeat(5000), { headers: { "Content-Type": "text/event-stream" } })],
    ];
    for (const [request, response] of cases) expect(compressResponse(request, response)).toBe(response);
  });
});

describe("withTextCharset", () => {
  it("marks bare text/plain as UTF-8 and leaves other types and explicit charsets alone", () => {
    expect(withTextCharset(new Response("x", { headers: { "Content-Type": "text/plain" } })).headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(withTextCharset(new Response("x", { headers: { "Content-Type": "text/plain; charset=iso-8859-1" } })).headers.get("Content-Type")).toBe("text/plain; charset=iso-8859-1");
    expect(withTextCharset(new Response("x", { headers: { "Content-Type": "text/html" } })).headers.get("Content-Type")).toBe("text/html");
    expect(withTextCharset(Response.redirect("http://club.test/", 302)).headers.get("Content-Type")).toBeNull();
  });
});
