import { createFileRoute } from "@tanstack/react-router";

// Built from the database on each request (src/server/sitemap.ts), on the app's own origin (APP_URL).
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [{ getDb }, { sitemapXml }, { appUrl }] = await Promise.all([
          import("@/server/db"), import("@/server/sitemap"), import("@/server/email"),
        ]);
        return new Response(sitemapXml(getDb(), appUrl()), {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
