import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size and the caller are checked (see submitApplicationRequest in src/features/applications/applications.server.ts).
export const Route = createFileRoute("/api/applications")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { actorFrom }, { submitApplicationRequest }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/features/applications/applications.server"),
        ]);
        return submitApplicationRequest({ db: getDb(), actor: await actorFrom(request.headers) }, request);
      },
    },
  },
});
