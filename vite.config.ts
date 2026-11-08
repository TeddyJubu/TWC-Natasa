import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Builds a Node server (dist/server/server.js, from src/server.ts) and the client assets (dist/client);
// server.mjs serves both (`bun run start`).
export default defineConfig(({ mode }) => {
  // Server code reads process.env (APP_URL, BETTER_AUTH_SECRET, …): in dev, take them from .env / .env.local too.
  process.env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    server: { host: "localhost", port: 8080 },
    // `@/*` comes from tsconfig.json `paths` (Vite's native resolver; no plugin, no duplicate alias).
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  };
});
