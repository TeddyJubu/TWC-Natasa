# Agents

- All design-system source (theme CSS, components, helpers) lives in `src/design-system/` and is re-exported from `src/index.ts` — attach copies only that subtree, so nothing there may import from outside it.
- Showcase pages live in `src/routes/` and showcase-only helpers in `src/showcase/` (excluded via `.dsignore`) — they are preview-only and never re-exported.
- Tokens are CSS variables mapped through `@theme inline` in `theme.css` — keeps light/dark switching to a single `.dark` class.
- Form primitives use editorial and boxed variants from one shared family — keeps long applications expressive and compact forms consistent.
- Motion uses shared CSS timing tokens and reduced-motion fallbacks — keeps interactions consistent and accessible without adding a runtime dependency.
- Long membership forms compose reusable field, choice, notice, progress, section, and action primitives — keeps dense applications consistent and accessible.
- The uploaded constellation artwork is the canonical logo and `ConstellationLogo` owns its fixed color variants — preserves the original geometry across every brand context.
