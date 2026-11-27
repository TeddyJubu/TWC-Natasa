import { createFileRoute } from "@tanstack/react-router";

// A visitor joins a full event's waitlist (event_waitlist, 0021) after the RSVP route's rate limit and size check.
export const Route = createFileRoute("/api/gatherings/$uid/waitlist")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { uid: string } }) => {
        const [{ getDb }, { waitlistRequest }] = await Promise.all([import("@/server/db"), import("@/features/cal/cal.server")]);
        return waitlistRequest(getDb(), request, params.uid);
      },
    },
  },
});
