// The app runs as a plain Node server on the VPS (server.mjs → dist/server/server.js), not a Cloudflare Worker.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

describe("node runtime", () => {
  it("has no Cloudflare Worker tooling left", () => {
    expect(Object.keys(deps).filter((d) => /wrangler|cloudflare/.test(d))).toEqual([]);
    expect(existsSync("wrangler.jsonc")).toBe(false);
    expect(readFileSync("vite.config.ts", "utf8")).not.toMatch(/cloudflare/);
  });

  it("starts the built server with srvx on HOST/PORT, default 127.0.0.1:8788, static files included", () => {
    expect(pkg.scripts.start).toMatch(/^node .*server\.mjs$/);
    const server = readFileSync("server.mjs", "utf8");
    expect(server).toContain('from "srvx"');
    expect(server).toContain('staticMiddleware({ dir: "dist/client" })');
    expect(server).toMatch(/process\.env\.HOST \|\| "127\.0\.0\.1"/);
    expect(server).toMatch(/process\.env\.PORT \|\| 8788/);
    // Headers wrap the static middleware, so assets get them too.
    expect(server.indexOf("withSecurityHeaders(await next())")).toBeLessThan(server.indexOf("staticMiddleware("));
    // The PIN gate answers before static files or the app, so nothing is served without it (src/server/site-pin.ts).
    expect(server.indexOf("pinGate(request)")).toBeGreaterThan(server.indexOf("withSecurityHeaders(await next())"));
    expect(server.indexOf("pinGate(request)")).toBeLessThan(server.indexOf("staticMiddleware("));
  });
});
