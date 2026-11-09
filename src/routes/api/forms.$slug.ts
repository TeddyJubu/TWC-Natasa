import { createFileRoute } from "@tanstack/react-router";

// The body is read only after the slug, its size and the visitor's rate are checked (see formRequest in src/features/forms/forms.server.ts).
export const Route = createFileRoute("/api/forms/$slug")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { slug: string } }) => {
        const [{ getDb }, { formRequest }] = await Promise.all([import("@/server/db"), import("@/features/forms/forms.server")]);
        // Anyone may answer an open form, so the session is never looked up.
        return formRequest({ db: getDb(), actor: null }, request, params.slug);
      },
    },
  },
});
