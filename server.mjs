// Production server (`bun run start`): the built TanStack Start handler plus dist/client's static files, on
// HOST:PORT (default 127.0.0.1:8788, where Caddy proxies). Every response, static ones included, gets the
// security headers from src/app/security-headers.ts, and while SITE_PIN is set every request passes the PIN gate
// (src/server/site-pin.ts) before anything else answers it. Then (src/server/edge.ts) a page path with a trailing slash
// gets a 308 to the path without it, hashed /assets/* files are cached for a year, and the app's HTML/JSON/XML is
// gzipped when the client takes it (srvx's static middleware compresses static files itself).
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import app, { compressResponse, pinGate, trailingSlashRedirect, withAssetCaching, withSecurityHeaders } from "./dist/server/server.js";

serve({
  hostname: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 8788),
  middleware: [
    async (_request, next) => withSecurityHeaders(await next()),
    async (request, next) => (await pinGate(request)) ?? next(),
    (request, next) => trailingSlashRedirect(request) ?? next(),
    async (request, next) => withAssetCaching(new URL(request.url).pathname, await next()),
    staticMiddleware({ dir: "dist/client" }),
  ],
  fetch: async (request) => compressResponse(request, await app.fetch(request)),
});
