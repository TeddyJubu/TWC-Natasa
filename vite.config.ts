import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";
import tailwindcss from "@tailwindcss/vite";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin.ts";

export default defineConfig(({ command, mode }) => {
  // Cloudflare Workers plugin only on build (produces the worker output);
  // the workerd runtime isn't available for the dev server.
  const useCloudflare = command === "build";

  return {
    server: {
      host: "localhost",
      port: 8080,
    },
    // `@/*` comes from tsconfig.json `paths` (Vite's native resolver; no plugin, no duplicate alias).
    resolve: { tsconfigPaths: true },
    plugins: [
      mockupPreviewPlugin({ designSystemPolling: true }),
      tailwindcss(),
      ...(useCloudflare ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
      tanstackStart(),
      viteReact(),
      ...(mode === "development" ? [componentTagger()] : []),
    ],
  };
});
