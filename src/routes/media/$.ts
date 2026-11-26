import { createFileRoute } from "@tanstack/react-router";

// Uploaded images (src/server/media.ts): visibility follows the old storage policies; anything else is a 404.
// Event covers (src/server/covers.ts) follow their event in Cal; the roster's photos (features/roster) its rule.
export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/media/covers/")) {
          const [{ serveCover }, { coverSource }] = await Promise.all([import("@/server/covers"), import("@/features/cal/cal.server")]);
          return serveCover(url, request.headers, coverSource);
        }
        if (url.pathname.startsWith("/media/roster/")) {
          const [{ getDb }, { actorFrom }, { serveRosterPhoto }] = await Promise.all([
            import("@/server/db"), import("@/server/context.server"), import("@/features/roster/roster.server"),
          ]);
          return serveRosterPhoto(getDb(), await actorFrom(request.headers), url.pathname, request.headers);
        }
        const [{ getDb }, { actorFrom }, { serveMedia }] = await Promise.all([
          import("@/server/db"), import("@/server/context.server"), import("@/server/media"),
        ]);
        return serveMedia(getDb(), await actorFrom(request.headers), new URL(request.url).pathname, request.headers);
      },
    },
  },
});
