import { createFileRoute } from "@tanstack/react-router";
import { apiNotFound } from "@/server/api-notfound";

/** CRM-010: unknown `/api/*` is a JSON 404, never the app page. Listed routes win over this splat. */
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: () => apiNotFound(),
      POST: () => apiNotFound(),
      PUT: () => apiNotFound(),
      PATCH: () => apiNotFound(),
      DELETE: () => apiNotFound(),
      HEAD: () => apiNotFound(),
      OPTIONS: () => apiNotFound(),
    },
  },
});
