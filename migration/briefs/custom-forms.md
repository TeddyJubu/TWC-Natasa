# Workstream: custom-forms (cutover slice)

Read `migration/BRIEF.md`, OPS-518 (apex `/f/*` must keep working), Part D `custom_pages` / forms service items, CRM custom-form capabilities.

## Build now (minimum for cutover)

1. **Serve published custom forms at `/f/$slug`** (scrapbook or a lean form shell) so apex redirects can land here.
2. **POST handler** with size + rate limit + honeypot; store in SQLite (new tables as needed — next free migration after `0004` is **`0005_*`**).
3. Thank-you / closed states; media under `/f/media/*` or `/media/*` with magic-byte checks.
4. Admin list of form responses in `/admin` (app shell) — enough to retire the old forms container.
5. Do **not** port: unsigned spam stamp without secret, silent exit-0 failures, Google Fonts (self-host or drop), Beehiiv without consent.

Full form-builder parity can follow; this slice unblocks VPS cutover for `/f/*`.

## Done when

Routes exist, tests cover guards/storage, manifest items for this slice → `built`. Commit only.
