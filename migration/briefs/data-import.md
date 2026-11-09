# Workstream: data-import

Read `migration/BRIEF.md` and manifest items with `owner: "data-import"`.

## Build now

1. **Import script** `scripts/import-legacy.ts` that reads **made-up** fixtures shaped like the VPS exports:
   - applications (128 shape), members/profiles (120), newsletter subscribers (44), optional `submissions.jsonl` rows for inbox.
   - Develop against `.migration/legacy/testdata/` only. Never copy real PII off the VPS into the repo.
2. **Email match on sign-up:** when a user verifies the same email as an imported member/application without a login, link `profiles.user_id` / `applications.user_id`. Never auto-approve (BRIEF decision 10).
3. Fixtures under `scripts/fixtures/legacy-*.json` (synthetic). Tests assert counts and the no-self-approve rule.
4. Document the VPS one-shot command in `migration/briefs/data-import.md` (paths on server only, no secrets).

## Done when

- Tests pass; manifest items you finish → `built` with evidence.
- Commit only; no push/merge unless integrator asks.
