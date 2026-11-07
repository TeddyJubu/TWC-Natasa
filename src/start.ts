import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { securityHeadersMiddleware } from "@/app/security-headers";

// Defining a start instance replaces Start's default request middleware, so its CSRF check for server
// functions is restated here exactly as Start's default.
export const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

// Headers first, so they also land on a CSRF 403.
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
}));
