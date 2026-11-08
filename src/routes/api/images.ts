import { createFileRoute } from "@tanstack/react-router";

// The body is read only after its size and the caller are checked (see uploadImageRequest in src/features/members/members.server.ts).
export const Route = createFileRoute("/api/images")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ getDb }, { actorFrom }, { uploadImageRequest }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/features/members/members.server"),
        ]);
        return uploadImageRequest({ db: getDb(), actor: await actorFrom(request.headers) }, request);
      },
    },
  },
});
