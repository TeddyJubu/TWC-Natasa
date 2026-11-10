// Production server (`bun run start`): the built TanStack Start handler plus dist/client's static files, on
// HOST:PORT (default 127.0.0.1:8788, where Caddy proxies). Every response, static ones included, gets the
// security headers from src/app/security-headers.ts, and while SITE_PIN is set every request passes the PIN gate
// (src/server/site-pin.ts) before anything else answers it.
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import app, { pinGate, withSecurityHeaders } from "./dist/server/server.js";

serve({
  hostname: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 8788),
  middleware: [
    async (_request, next) => withSecurityHeaders(await next()),
    async (request, next) => (await pinGate(request)) ?? next(),
    staticMiddleware({ dir: "dist/client" }),
  ],
  fetch: (request) => app.fetch(request),
});
