// Start's default server entry, plus what server.mjs puts in front of everything, static assets included: the security
// headers and the private-preview PIN gate. Refuses to start without a usable BETTER_AUTH_SECRET.
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { authSecret } from "@/server/secret";

export { withSecurityHeaders } from "@/app/security-headers";
export { pinGate } from "@/server/site-pin";

// Fail at startup, not on the first sign-in.
authSecret();

export default createServerEntry({ fetch: (request) => handler.fetch(request) });
