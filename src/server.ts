// Start's default server entry, plus the security headers for server.mjs to put on static assets too. Refuses to
// start without a usable BETTER_AUTH_SECRET.
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { authSecret } from "@/server/secret";

export { withSecurityHeaders } from "@/app/security-headers";

// Fail at startup, not on the first sign-in.
authSecret();

export default createServerEntry({ fetch: (request) => handler.fetch(request) });
