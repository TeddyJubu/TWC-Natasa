import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size and the client IP's rate are checked (see sendContactRequest in src/features/contact/contact.server.ts).
export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { sendContactRequest }] = await Promise.all([import("@/server/db"), import("@/features/contact/contact.server")]);
        // Anyone may write, so the session is never looked up.
        return sendContactRequest({ db: getDb(), actor: null }, request);
      },
    },
  },
});
