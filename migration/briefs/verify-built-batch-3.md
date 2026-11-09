# Workstream: verify-built-batch (3)

Same rules as `verify-built-batch.md`. Flip clear `built` → `verified`.

## Prefer

- Custom-forms editor: **CRM-104, CRM-105, CRM-106, CRM-117, CRM-118, CRM-119**
  (and CRM-103 only if evidence is no longer "partial")
- Any solid leftovers still `built` from prior phases with tests

Leave merge/spam/Hermes/Notion/webhook/partial items alone (phase 7 may retire
some).

## Done when

Commit on worktree only; report counts + `migration:check` summary. Do not push.
