import { createFileRoute } from "@tanstack/react-router";

// Uploaded images (src/server/media.ts): visibility follows the old storage policies; anything else is a 404.
export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [{ getDb }, { actorFrom }, { serveMedia }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/server/media"),
        ]);
        return serveMedia(getDb(), await actorFrom(request.headers), new URL(request.url).pathname, request.headers);
      },
    },
  },
});
