# Workstream: verify-built-batch

Flip `built` → `verified` for items whose evidence already matches the code on
`main`. Read `migration/BRIEF.md`, `scripts/migration-check.ts`,
`migration/verify-haiku.md` (prior method), and `migration/manifest.json`.

## Rules

1. Only change status when you can cite a concrete file/test/route that satisfies
   `acceptance`. Prefer items with existing tests or routes already covered by
   vitest.
2. Do **not** invent behaviour. If evidence is weak or partial, leave `built`.
3. Prefer batches that unlock cutover confidence:
   - Spotlight / review / member-links (OPS-028…, CRM-082…)
   - Admin parity phases 1–5 (CRM-041, 055, 057, 058, 062, 068, 069, 072, 073, 093, 186…)
   - Notifications alerts already shipped (OPS-257…, alertApplication/Spotlight/Review)
   - Custom forms open/close + CSV (CRM-099/100/103/130) and `/f/*` cutover slice
4. Update `evidence` with a short verify note (`verified YYYY-MM-DD: <pointer>`).
5. Run `bun run migration:check` at the end and report the remaining counts
   (todo / built / verified). Do not expect it to go green yet.
6. Commit on the worktree branch only; do not push. No product code changes unless
   a one-line acceptance/evidence fix is required for honesty.

## Done when

Manifest updated; typecheck/lint/tests/build still green (or untouched if you only
edited JSON/md); report how many flipped and what's still blocking the gate.
