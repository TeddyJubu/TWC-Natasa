import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size and the caller are checked (see neighborhoodLogoRequest in src/features/admin/admin.server.ts).
export const Route = createFileRoute("/api/neighborhood-logos")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { actorFrom }, { neighborhoodLogoRequest }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/features/admin/admin.server"),
        ]);
        return neighborhoodLogoRequest({ db: getDb(), actor: await actorFrom(request.headers) }, request);
      },
    },
  },
});
