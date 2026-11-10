import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size, the caller and her post limit are checked (see feedRequest in src/features/feed/feed.server.ts).
export const Route = createFileRoute("/api/feed")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { actorFrom }, { feedRequest }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/features/feed/feed.server"),
        ]);
        return feedRequest({ db: getDb(), actor: await actorFrom(request.headers) }, request);
      },
    },
  },
});
