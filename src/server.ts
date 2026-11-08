// Start's default server entry, plus the security headers for server.mjs to put on static assets too.
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export { withSecurityHeaders } from "@/app/security-headers";

export default createServerEntry({ fetch: (request) => handler.fetch(request) });
