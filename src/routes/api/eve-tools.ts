import { createFileRoute } from "@tanstack/react-router";

// The Eve service calling back. No cookie is involved: a short-lived signed token names the admin it acts for.
export const Route = createFileRoute("/api/eve-tools")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { toolRequest }] = await Promise.all([import("@/server/db"), import("@/features/eve/eve.server")]);
        return toolRequest(getDb(), request);
      },
    },
  },
});
