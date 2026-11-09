# Workstream: vps-cutover

Read `migration/BRIEF.md` (decisions 1–2, 8, 10–11), `migration/redirects.md`,
`scripts/migration-check.ts` (`OLD_TO_NEW`), `AUDIT-TASKS.md`, and the Hostinger / Caddy notes
in the inventories. Owner decisions are fixed — do not ask.

## Hard limits

- Touch **only** TWC blocks in `/opt/nbwc/Caddyfile` and TWC services in `/opt/nbwc/compose.yaml`
  (BRIEF 11). Never touch Vantrix, Hermes, studio, natasatuohy.com, buzz, or nbwc.site blocks
  beyond the TWC redirects already listed for join/forms hosts.
- **Backup with timestamp first**; `caddy validate` before reload.
- Archive old pages — **never delete** (BRIEF 2).
- Apex `/` stays the coming-soon page (BRIEF 1). `/index.html` → `/` only.

## `/f/*` gate (do not break live forms)

`migration/redirects.md`: do **not** 301 apex `/f/*` to the new app until live forms are imported
into `custom_forms` (workstream `forms-import`). Until that lands and is confirmed on the VPS:

- Keep serving `/f/*` (and `/forms`, `/f/media/*`, `event.ics`, thanks variants) from the **old**
  site / forms stack.
- Do **not** stop `twc-site-forms`, forms containers, or related timers.
- You **may** prepare the Caddy snippet for `/f/*` → `https://new.thewomenscollective.club{uri}`
  (keep path + query) as a commented block or docs-only patch, ready to enable after import.

If `forms-import` finishes and is merged/deployed with forms present in the app DB before you
finish, enable the `/f/*` 301 for imported slugs and then stop only the forms pieces that are
fully replaced — still leave waitlist / media / event.ics on the old stack if they have no new
route (see redirects.md "Not redirected yet").

## Build / do now

1. **Redirect map → live Caddy** for every row in `migration/redirects.md` "Pages" and host
   redirects that are ready:
   - Both tidy path and `.html` path → one-hop `301` to `https://new.thewomenscollective.club…`.
   - `members.*/review?t=…` → new `/review?t=…` **keeping the query**.
   - join / apply hosts as in the map.
   - Leave `/f/*` per the gate above.

2. **Archive** the old static pages listed in BRIEF decision 3 onto the VPS archive location
   (do not invent a path if inventories already name one; otherwise use a timestamped folder
   under the existing TWC data tree and record it in `AUDIT-TASKS.md`).

3. **Legacy data import** (if not already done on the VPS): run the documented
   `scripts/import-legacy.ts` one-shot from `migration/briefs/data-import.md` against the live
   app DB (backup first). Counts only in logs — no PII.

4. **Stop old timers/containers** only for pieces fully replaced (static site pages that now
   301, intake that now lives in the app). Leave CRM / forms / anything still serving live
   `/f/*` or unfinished CRM parity running. Record each stop in `AUDIT-TASKS.md`.

5. **Smoke** every mapped old URL (tidy + `.html`) lands on the new page; apex `/` still
   coming-soon; `/review?t=` bad token → same 404 as before; `/f/<known-old-slug>` still works
   on whatever host currently serves it.

6. **Manifest**: mark finished `vps-cutover` items `built` with evidence (Caddy snippet refs,
   archive path, smoke notes). Update `AUDIT-TASKS.md`. Commit docs/scripts that belong in the
   repo; VPS-only changes are recorded as evidence, not secrets.

## Repo deliverables

- Any Caddy snippet / runbook under `migration/` (e.g. `migration/caddy-twc-redirects.caddy` or
  an update to `redirects.md`) that matches what was applied.
- No secrets in git. Env names only.

## Done when

Typecheck/lint/tests/build still pass if code changed; commit on the worktree branch.
Cutover is reversible via the timestamped Caddy/compose backups.
