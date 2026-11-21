import { createFileRoute } from "@tanstack/react-router";

// Reschedule, cancel or add guests from a manage link. A group session also needs the person's own seat id.
export const Route = createFileRoute("/api/booking/$uid")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { uid: string } }) => {
        const { manageRequest } = await import("@/features/cal/cal.server");
        return manageRequest(request, params.uid);
      },
    },
  },
});
