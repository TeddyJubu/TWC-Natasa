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
