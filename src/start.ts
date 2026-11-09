import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { securityHeadersMiddleware } from "@/app/security-headers";

// Defining a start instance replaces Start's default request middleware, so its CSRF check for server
// functions is restated here, extended to our own POST routes (cookie-authenticated uploads, applications, contact messages, partnership inquiries and member reviews).
// Better Auth's /api/auth/* checks origins itself.
const API_ROUTES = /^\/api\/(images|neighborhood-logos|applications|contact|partnerships|review)\/?$/;
export const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn" || API_ROUTES.test(ctx.pathname),
});

// Headers first, so they also land on a CSRF 403.
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
}));
