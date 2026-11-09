# Workstream: forms-import (custom-forms follow-up)

Unblocks apex `/f/*` redirects (OPS-518). The cutover slice already serves `/f/<slug>` from
SQLite (`0005_custom_forms.sql`); **live forms are not in the new DB yet**, so redirecting now
would 404 every real link.

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md` (custom-forms decisions),
`src/features/forms/{schema,store,forms.server}.ts`, and `migration/briefs/data-import.md`
(CLI / Node / fixtures pattern).

## Why not the published JSON alone

Published files at `crm/published/custom/<id>.json` list `fields` **without choices** — radio /
checkbox / dropdown / scale choices live only inside the pre-rendered `html`. Definitions with
choices are in the **CRM SQLite** (`custom_forms`, `custom_form_slugs`, `form_versions` under
`form_key = 'custom:<id>'`). See `.migration/legacy/crm/server/customforms.ts`.

## Build now

1. **Importer** `scripts/import-forms.ts` + `src/features/forms/import.server.ts` (or similar),
   Node (`node:sqlite`), same style as `scripts/import-legacy.ts`:
   - `--crm-db <path>` — read live/published definitions from the CRM database.
   - Optional `--published-dir` only as a fallback for open/closed / intro HTML → plain text when
     the DB row is missing; **never invent choices from HTML**.
   - `--submissions <submissions.jsonl>` — import `form: "custom"` rows into
     `custom_form_responses` (keep `form_id`, `form_version`, answers by question key, email).
   - `--db` target app DB; `--dry-run`; re-run safe (insert/update by id; don't duplicate responses —
     use a stable legacy key if one exists, else skip already-imported by `(form_id, created_at, email)`
     or document the chosen idempotency rule in AUDIT-TASKS).
   - Write forms only through `saveForm()` so `checkQuestions` stays the gate.

2. **Map CRM fields → our `Question` model**
   - Supported today: short, email, phone, url, number, date, paragraph, dropdown, radio,
     checkboxes, yesno.
   - Pull `choices` from the CRM `form_versions.definition` fields.
   - Strip HTML from intro/thanks/closed to plain text (paragraphs on blank lines), matching the
     cutover decision (no HTML sanitizer).
   - Copy `old_slugs` from `custom_form_slugs` (all names except the current slug).
   - Preserve 8-char `id`, slug, name, version, open, one_per_email, closed_message.

3. **Unsupported question types** (consent, statement, file, time, rating, scale, hidden,
   ranking, grid, address, total):
   - Prefer a **lossless-enough conversion** when obvious (e.g. `scale`/`rating` → `radio` with
     numeric choices from the definition; `consent` → required `yesno` or a single required
     checkbox; `statement` dropped or stored as help-only if the schema allows).
   - If a form still can't be represented, **skip that form**, print a count + type list in the
     report (never PII), leave it `todo` in the manifest with evidence, and do **not** claim
     OPS-518 ready for that slug.
   - Do not invent the form builder, `/f/media/*`, waitlist, or confirmation emails here.

4. **Fixtures + tests**
   - Synthetic CRM DB (or JSON dump shaped like `form_versions` + `custom_forms` + slugs) under
     `scripts/fixtures/` — made-up only. The empty
     `.migration/legacy/testdata/crm/crm.db` is useless; build a fixture yourself.
   - Include at least one form with radio/checkbox **choices**, one old slug, one closed form,
     one `scale` (or other converted type), and matching `form: "custom"` submission rows.
   - Tests: import counts, choices survive, old-slug 301 path still works after import,
     unsupported-type reporting, idempotent re-run, no PII in logs.

5. **Docs**
   - VPS one-shot in this brief (paths only, no secrets), mirroring data-import.
   - Update `AUDIT-TASKS.md`, `migration/redirects.md` (forms imported → `/f/*` redirect unblocked
     for imported slugs; note any skipped), and mark finished manifest items `built` with evidence.
   - Do **not** edit Caddy or stop services (that's `vps-cutover`).

## Done when

Typecheck, lint, vitest, build pass; commit on the worktree branch only (no push/PR unless asked).
Manifest items this slice finishes → `built`. Record any skipped live-form types as owner notes.

## Built (branch `t3/ad7c244c`)

- `scripts/import-forms.ts` (CLI, **Node**, `node:sqlite`) → `src/features/forms/import.server.ts` (logic) +
  `src/features/forms/import.test.ts`. No new migration: everything fits `0005_custom_forms.sql`.
- Synthetic fixtures: `scripts/fixtures/crm-forms.json` (a dump shaped like the CRM's `custom_forms`,
  `custom_form_slugs`, `form_versions`; `--crm-db` accepts it as well as a real `crm.db`) and
  `scripts/fixtures/forms-submissions.json`.
- Rules (also in `AUDIT-TASKS.md`): definitions from the newest `form_versions` row; conversions scale/rating → radio,
  consent → one required tick box, time → short; statement/hidden/total dropped; file/ranking/grid/address → form
  skipped; required + show-if → optional. Answers keyed by a hash of the whole JSONL line (stored as the response id),
  so re-runs add only new lines; tombstones and `held.json` answers stay out.

### VPS one-shot (paths on the server only; no secrets)

Run on the VPS from the deployed checkout, as the user that owns the app database, **after** the data-import one-shot.
Nothing is stopped: `.backup` takes a consistent copy of the CRM's database while it runs.

```sh
cd /opt/twc-natasa                                   # the deployed repo (README: twc-natasa.service)
DB=/var/lib/twc-natasa/data/twc.db
STAMP=$(date +%F-%H%M)
sqlite3 "$DB" ".backup '/var/backups/twc-natasa/pre-forms-import-$STAMP.db'"
sqlite3 /opt/nbwc/data/crm/crm.db ".backup '/var/backups/twc-natasa/crm-copy-$STAMP.db'"   # read-only copy of the CRM
ARGS="--crm-db /var/backups/twc-natasa/crm-copy-$STAMP.db --published-dir /opt/nbwc/data/crm/published/custom \
  --submissions /opt/nbwc/data/submissions.jsonl --held /opt/nbwc/data/crm/held.json --db $DB"
node --experimental-strip-types scripts/import-forms.ts $ARGS --dry-run   # read the report
node --experimental-strip-types scripts/import-forms.ts $ARGS             # then for real
```

The report lists every form (id, slug, `imported`/`updated`/`skipped` + reason, conversions, dropped types) and the
answer counts (`read`, `imported`, `existing`, skipped by reason); never an answer or an email. Drop `--held` if
`held.json` is missing. Re-running is safe. **Hand the list of skipped slugs to vps-cutover**: `/f/<slug>` for those
must keep going to the old site (or stay unrouted) until the type is supported; every imported slug and its old names
can 301 (path + query) per `migration/redirects.md`. Record skipped live forms as owner notes in `AUDIT-TASKS.md`.
