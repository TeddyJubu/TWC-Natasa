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

## Built (branch `t3/76b2f1fb`)

- `scripts/import-legacy.ts` (CLI, runs on **Node**, not Bun — `node:sqlite`) → `src/server/legacy-import.ts` (logic + tests).
- `db/migrations/0003_legacy_import.sql`: `applications.legacy_id`, `legacy_members`, `newsletter_subscribers`, and the replaced
  `user_created` / `user_verified` triggers that link by verified email.
- Synthetic fixtures: `scripts/fixtures/legacy-{applications,members,subscribers,submissions}.json`.

### VPS one-shot (paths on the server only; no secrets)

Run on the VPS from the deployed checkout, as the user that owns the database. Node ≥ 22.13 (22.18+ needs no flag).

```sh
cd /opt/twc-natasa                                   # the deployed repo (README: twc-natasa.service)
DB=/var/lib/twc-natasa/data/twc.db
sqlite3 "$DB" ".backup '/var/backups/twc-natasa/pre-import-$(date +%F-%H%M).db'"
node --experimental-strip-types scripts/import-legacy.ts --dir /opt/nbwc/data --db "$DB" --dry-run   # read the counts
node --experimental-strip-types scripts/import-legacy.ts --dir /opt/nbwc/data --db "$DB"             # then for real
```

`--dir` expects the old layout: `intake/new_applications.jsonl`, `intake/members.jsonl`, `intake/subscribers.jsonl`,
`submissions.jsonl`. Add `--inbox-new` to import contact/partnership messages as `new` instead of `archived`.
Re-running is safe (insert-only; the report shows `existing`). Expected: ~128 applications, ~120 members, ~44 subscribers,
fewer where merged / archived / bad-email rows are skipped (each reason is counted in the report). The app starts the same
migrations on boot, so the schema is already there; the importer also applies pending migrations when it opens the file.

### Link-on-sign-up (SQL triggers, so Google and email/password both get it)

When an account's email is **verified** (at insert, or when `emailVerified` flips to 1), matched case-insensitively:
unclaimed `legacy_members` fill her blank profile fields (business, role, website, bio) and member-since, and approve her
profile *because the old CRM had approved her*; unclaimed `applications` get her `user_id` (status rules from 0001 are
unchanged: approved/declined application → profile). An unverified account, a pending applicant or a stranger stays
`pending`. `/join` can only insert `pending` rows; directory/public-page visibility is never copied from the old record.

### Left for other workstreams

`review_responses.jsonl` / `links.jsonl` (members-links mints new hashed links, old tokens are not imported),
`spotlight_answers.jsonl` (members-links), `form: "custom"` rows (custom-forms), Beehiiv consent handling (notifications:
`newsletter_subscribers.consent` is null for the old Beehiiv list, 1/0 where a form recorded it).
