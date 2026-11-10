import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { securityHeadersMiddleware } from "@/app/security-headers";

// Defining a start instance replaces Start's default request middleware, so its CSRF check for server
// functions is restated here, extended to our own POST routes (cookie-authenticated uploads and newsfeed posts, applications, contact messages, partnership inquiries, member reviews, Spotlight answers and custom-form answers).
// Better Auth's /api/auth/* checks origins itself.
const API_ROUTES = /^\/api\/(images|feed|neighborhood-logos|applications|contact|partnerships|review|spotlight|forms\/[^/]+)\/?$/;
export const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn" || API_ROUTES.test(ctx.pathname),
});

// Headers first, so they also land on a CSRF 403.
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
}));
