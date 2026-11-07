# Agents

- All design-system source (theme CSS, components, helpers) lives in `src/design-system/` and is re-exported from `src/index.ts` — attach copies only that subtree, so nothing there may import from outside it. App code imports it only via `@/index`; ESLint `no-restricted-imports` enforces both directions.
- Showcase pages (`/colors`, `/typography`, `/components`) live in `src/routes/` and are the only routes on the `Shell` toolbar from `src/showcase/` (showcase-only helpers, excluded via `.dsignore`); they carry `noindex` and are disallowed in `public/robots.txt` with the preview routes. Live pages use `AppPage`, `AppNav` and `AppFooter` from `src/app/layout/AppLayout.tsx` — keeps the design-system toolbar off the live site and out of search, while the showcase stays preview-only and never re-exported.
- Tokens are CSS variables mapped through `@theme inline` in `theme.css` — keeps light/dark switching to a single `.dark` class.
- Form primitives use editorial and boxed variants from one shared family — keeps long applications expressive and compact forms consistent.
- Motion uses shared CSS timing tokens and reduced-motion fallbacks — keeps interactions consistent and accessible without adding a runtime dependency.
- Long membership forms compose reusable field, choice, notice, progress, section, and action primitives — keeps dense applications consistent and accessible.
- The uploaded constellation artwork is the canonical logo and `ConstellationLogo` owns its fixed color variants — preserves the original geometry across every brand context.
- Immersive image strips use the self-contained OGL circular gallery with a static reduced-motion fallback — preserves the editorial arc while remaining accessible and attach-safe.
- Decorative pointer motion uses the self-contained flower `ImageTrail`, disabled for touch and reduced motion — keeps the playful flourish accessible and attach-safe.
- Demo member profiles live in `src/showcase/demo-members.ts` (with their portraits in `src/showcase/assets/`), outside the design system and the public barrel; only `MemberProfile` is type-exported with `MemberCard` — keeps the reusable API typed without pulling sample portraits into consumer bundles.
- Member accounts use Lovable Cloud auth; membership status, catalogue number, and member-since are admin-only fields guarded by a database trigger — members can never self-approve.
