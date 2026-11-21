import { createFileRoute } from "@tanstack/react-router";

// Built from the database and Cal's listed events on each request (src/server/sitemap.ts), on the app's own origin (APP_URL).
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [{ getDb }, { sitemapXml }, { appUrl }, { sitemapEvents }] = await Promise.all([
          import("@/server/db"), import("@/server/sitemap"), import("@/server/email"), import("@/features/cal/cal.server"),
        ]);
        return new Response(sitemapXml(getDb(), appUrl(), await sitemapEvents()), {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
