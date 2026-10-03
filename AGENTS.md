# Agents

- All design-system source (theme CSS, components, helpers) lives in `src/design-system/` and is re-exported from `src/index.ts` — attach copies only that subtree, so nothing there may import from outside it.
- Showcase pages live in `src/routes/` and showcase-only helpers in `src/showcase/` (excluded via `.dsignore`) — they are preview-only and never re-exported.
- Tokens are CSS variables mapped through `@theme inline` in `theme.css` — keeps light/dark switching to a single `.dark` class.
- Form primitives use editorial and boxed variants from one shared family — keeps long applications expressive and compact forms consistent.
- Motion uses shared CSS timing tokens and reduced-motion fallbacks — keeps interactions consistent and accessible without adding a runtime dependency.
- Long membership forms compose reusable field, choice, notice, progress, section, and action primitives — keeps dense applications consistent and accessible.
- The uploaded constellation artwork is the canonical logo and `ConstellationLogo` owns its fixed color variants — preserves the original geometry across every brand context.
- Immersive image strips use the self-contained OGL circular gallery with a static reduced-motion fallback — preserves the editorial arc while remaining accessible and attach-safe.
- Decorative pointer motion uses the self-contained flower `ImageTrail`, disabled for touch and reduced motion — keeps the playful flourish accessible and attach-safe.
- Demo member profiles live in a dedicated data module outside the public barrel, while `MemberCard` remains exported — keeps the reusable API attach-safe without pulling sample portraits into consumer bundles.
