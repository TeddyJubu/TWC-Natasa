import { createFileRoute } from "@tanstack/react-router";

// Better Auth's endpoints (sign-in, sign-up, verify-email, reset-password, Google callback, sign-out, …).
const handle = async ({ request }: { request: Request }) =>
  (await import("@/server/auth.server")).getAuth().handler(request);

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
