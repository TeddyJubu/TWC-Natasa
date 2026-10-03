# Agents

- All design-system source (theme CSS, components, helpers) lives in `src/design-system/` and is re-exported from `src/index.ts` — attach copies only that subtree, so nothing there may import from outside it.
- Showcase pages live in `src/routes/` and showcase-only helpers in `src/showcase/` (excluded via `.dsignore`) — they are preview-only and never re-exported.
- Tokens are CSS variables mapped through `@theme inline` in `theme.css` — keeps light/dark switching to a single `.dark` class.
- Form primitives use editorial and boxed variants from one shared family — keeps long applications expressive and compact forms consistent.
