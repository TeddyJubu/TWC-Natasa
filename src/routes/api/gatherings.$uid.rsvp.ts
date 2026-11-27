import { createFileRoute } from "@tanstack/react-router";

// A visitor's RSVP, proxied to Cal's public endpoint after this visitor's rate limit and the size check.
export const Route = createFileRoute("/api/gatherings/$uid/rsvp")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { uid: string } }) => {
        const [{ getDb }, { rsvpRequest }] = await Promise.all([import("@/server/db"), import("@/features/cal/cal.server")]);
        return rsvpRequest(request, params.uid, getDb());
      },
    },
  },
});
