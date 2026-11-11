import { createFileRoute } from "@tanstack/react-router";

// RFC 9116 contact for vulnerability reports (src/server/security-txt.ts), on the app's own origin (APP_URL).
export const Route = createFileRoute("/.well-known/security.txt")({
  server: {
    handlers: {
      GET: async () => {
        const [{ securityTxt }, { appUrl }] = await Promise.all([import("@/server/security-txt"), import("@/server/email")]);
        return new Response(securityTxt(appUrl()), {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
        });
      },
    },
  },
});
