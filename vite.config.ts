import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { publicFnId } from "./src/server/pin-open";

const UI_SDK_COMPONENTS = /src\/design-system\/components\/(select|switch|tabs|member-dialog)\.tsx$/;

// Builds a Node server (dist/server/server.js, from src/server.ts) and the client assets (dist/client);
// server.mjs serves both (`bun run start`).
export default defineConfig(({ mode }) => {
  // Server code reads process.env (APP_URL, BETTER_AUTH_SECRET, …): in dev, take them from .env / .env.local too.
  process.env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    server: { host: "localhost", port: 8080 },
    // `@/*` comes from tsconfig.json `paths` (Vite's native resolver; no plugin, no duplicate alias).
    // `@eve-chat` is an alias so the chat's heavy component types stay in their own typecheck (tsconfig.eve.json).
    resolve: { tsconfigPaths: true, alias: { "@eve-chat": fileURLToPath(new URL("./src/features/eve/EveChat.tsx", import.meta.url)) } },
    // The form pages' few browser-called functions get fixed ids, so the PIN gate can leave just those open.
    plugins: [tailwindcss(), tanstackStart({ serverFns: { generateFunctionId: publicFnId } }), viteReact()],
    // Importing anything from the design-system barrel must not load the ui-sdk controls a page doesn't use.
    build: { rollupOptions: { treeshake: { moduleSideEffects: (id: string) => !UI_SDK_COMPONENTS.test(id) } } },
  };
});
