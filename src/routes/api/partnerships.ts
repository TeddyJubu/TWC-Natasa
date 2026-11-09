import { createFileRoute } from "@tanstack/react-router";

// Stub: size-checked, body never read, always 501 until admin-inbox stores partnership inquiries
// (src/features/contact/partnership.server.ts). Replace the handler body, keep the route and its API_ROUTES entry.
export const Route = createFileRoute("/api/partnerships")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { partnershipRequest } = await import("@/features/contact/partnership.server");
        return partnershipRequest(request);
      },
    },
  },
});
