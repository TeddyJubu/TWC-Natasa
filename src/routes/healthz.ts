import { createFileRoute } from "@tanstack/react-router";

// The deploy's health check (/usr/local/sbin/twc-natasa-deploy): open even behind the site PIN, says nothing but "ok",
// and opens the database first, so a migration that fails on startup fails the deploy.
export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: async () => {
        const { getDb } = await import("@/server/db");
        getDb().prepare("select 1").get();
        return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      },
    },
  },
});
