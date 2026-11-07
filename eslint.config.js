import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".nitro", ".tanstack", ".wrangler", "src/routeTree.gen.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Boundary (a): design-system source may only import from itself (attach copies only that subtree).
  {
    files: ["src/design-system/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*", "@/**"],
              message:
                "src/design-system must not use the '@/' alias: attach copies only that subtree, so use relative imports inside src/design-system.",
            },
            {
              group: ["../../*", "../../**"],
              message:
                "src/design-system must not import outside itself: attach copies only that subtree.",
            },
            {
              group: ["@supabase/*", "@tanstack/*"],
              message:
                "The design system must not know about the backend or router (Supabase/TanStack): attach copies only that subtree. Pass data and callbacks via props.",
            },
          ],
        },
      ],
    },
  },
  // Boundary (b): everything else in src/ consumes the design system only via the barrel (@/index).
  // Globs are disjoint from (a) so no-restricted-imports is never overwritten.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/design-system/**", "src/index.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/design-system", "@/design-system/**", "**/design-system/**"],
              message:
                "Do not deep-import design-system internals; import from '@/index' (the barrel). Non-API assets belong outside src/design-system.",
            },
          ],
        },
      ],
    },
  },
);
