# Workstream: verify-built-batch (2)

Flip recent `built` → `verified` after phases that landed since batch 1.
Read `migration/briefs/verify-built-batch.md` (same rules) and
`migration/manifest.json`.

## Prefer verifying

- CRM phase 6: CRM-063, CRM-064, CRM-010 (+ retired companions if evidence is solid)
- Notifications phase 3: CRM-137, OPS-258, OPS-500, OPS-506, OPS-507, OPS-524
  (OPS-501 already verified — only refresh evidence if needed)
- Any other clear `built` with tests from the last merges

Leave weak/partial/Hermes/Notion/webhook/spam/merge items alone.

## Done when

Commit on the worktree branch only; report counts; run `migration:check` and
note remaining blockers. Do not push.
