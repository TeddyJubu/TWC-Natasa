import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size and the client IP's rate are checked (see spotlightRequest in src/features/member-links/spotlight.server.ts).
export const Route = createFileRoute("/api/spotlight")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { spotlightRequest }] = await Promise.all([import("@/server/db"), import("@/features/member-links/spotlight.server")]);
        // The link is the credential, so the session is never looked up.
        return spotlightRequest({ db: getDb(), actor: null }, request);
      },
    },
  },
});
