import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { "@eve-chat": fileURLToPath(new URL("./src/features/eve/EveChat.tsx", import.meta.url)) } },
  test: { include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["./src/test/setup.ts"] },
});
