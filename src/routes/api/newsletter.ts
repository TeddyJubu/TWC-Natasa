import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size and the client IP's rate are checked (see newsletterRequest in src/features/newsletter/newsletter.server.ts).
export const Route = createFileRoute("/api/newsletter")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { newsletterRequest }] = await Promise.all([import("@/server/db"), import("@/features/newsletter/newsletter.server")]);
        // Anyone may sign up, so the session is never looked up.
        return newsletterRequest({ db: getDb(), actor: null }, request);
      },
    },
  },
});
