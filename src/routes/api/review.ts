import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size and the client IP's rate are checked (see reviewRequest in src/features/member-links/member-links.server.ts).
export const Route = createFileRoute("/api/review")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { reviewRequest }] = await Promise.all([import("@/server/db"), import("@/features/member-links/member-links.server")]);
        // The link is the credential, so the session is never looked up.
        return reviewRequest({ db: getDb(), actor: null }, request);
      },
    },
  },
});
