import { createFileRoute } from "@tanstack/react-router";

// Books an appointment in Cal; the rate limit and size check run before the body is read.
export const Route = createFileRoute("/api/book")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { bookRequest } = await import("@/features/cal/cal.server");
        return bookRequest(request);
      },
    },
  },
});
