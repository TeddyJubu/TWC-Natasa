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

## Built (branch `t3/4e10b192`) — repo side only; **not applied on the VPS**

This run had no Hostinger/SSH access to the TWC VPS, so nothing below has been run there yet.
Repo pieces:

- `migration/caddy-twc-redirects.caddy`: the rules, as one `(snippet)` per TWC block, each saying which
  lines it replaces. Enabled: `twc_apex_cutover`, `twc_members_cutover`, `twc_nbwc_cutover`.
  Prepared but **not enabled**: `twc_forms_cutover` (apex `/f/*`, waits for forms-import),
  `twc_admin_cutover` / `twc_crm_cutover` (wait for CRM parity).
- `src/app/cutover-redirects.test.ts`: the snippet matches `migration/redirects.md` row for row (tidy
  + `.html`, one 301 hop, GET/HEAD only), `/` untouched, no `/f/*`, review query kept.
- `scripts/smoke-cutover.ts`: GET-only smoke of every mapped URL and host redirect (`bun`), from any
  machine; `--form <slug>` adds a live `/f/<slug>` that must still be a 200 on the apex.
- Checked locally with Caddy 2.10.2: the legacy Caddyfile with the three snippets pasted passes
  `caddy validate`, and a local run of the three blocks passes every smoke check (47/47; the 48th is
  the app's own `/review` 404, which only the live host can answer).

### Runbook (on the VPS, as root; paths only, no secrets)

0. **Pre-flight (read-only).**
   ```sh
   cd /opt/nbwc && docker compose ps && systemctl list-timers --all | grep -Ei 'twc|nbwc|notify|intake|notion|hermes'
   bun scripts/smoke-cutover.ts        # (from a checkout anywhere) baseline: the page rows FAIL with 200s today
   ```
   Pick one live form slug from `/opt/nbwc/site/f/` for `--form`.

1. **Backups (timestamped, before any edit).**
   ```sh
   TS=$(date +%Y%m%d-%H%M%S)
   cp -p /opt/nbwc/Caddyfile   /opt/nbwc/backups/Caddyfile.before-twc-cutover-$TS
   cp -p /opt/nbwc/compose.yaml /opt/nbwc/backups/compose.yaml.before-twc-cutover-$TS   # unchanged by this step; kept for rollback
   ```

2. **Archive the old pages (never delete, BRIEF 2; SITE-175/176).** One tarball of the served folder as
   it is, next to the server's other archives:
   ```sh
   tar -C /opt/nbwc -czf /opt/nbwc/backups/twc-site-archive-$TS.tar.gz site && sha256sum /opt/nbwc/backups/twc-site-archive-$TS.tar.gz
   ```
   The files **stay in `/opt/nbwc/site`**: the redirects make the pages unreachable, `index.html`,
   `404.html`, `assets/`, `embed.js`, `robots.txt` are still served, and `twc-site-forms` keeps writing
   `/f/*` there. Rollback is then the Caddyfile alone.

3. **Edit the Caddyfile on a copy**, `cp /opt/nbwc/Caddyfile /opt/nbwc/Caddyfile.next`, and in it:
   - `thewomenscollective.club {` — delete the `@nologin`/`redir @nologin` and `@apply`/`redir @apply`
     lines; paste the body of `twc_apex_cutover` at the top of the block.
   - `join.thewomenscollective.club, members.thewomenscollective.club {` — replace `@joinform { … }` and
     its `redir` with the body of `twc_members_cutover`.
   - `nbwc.site, … {` — delete `@join`/`redir @join` and the HeyForm comment + `@forms`/`redir @forms`;
     paste the body of `twc_nbwc_cutover` at the top of the block. Leave `@members`, `@admin` and the
     catch-all as they are.
   - Nothing else. `diff -u /opt/nbwc/Caddyfile /opt/nbwc/Caddyfile.next` must show only those three blocks.

4. **Install, validate, reload.** The container bind-mounts the single file read-only, so overwrite it
   **in place** (same inode — `mv`, `sed -i` or an editor that renames would leave the container on the
   old file):
   ```sh
   cat /opt/nbwc/Caddyfile.next > /opt/nbwc/Caddyfile
   docker compose -f /opt/nbwc/compose.yaml exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
     && docker compose -f /opt/nbwc/compose.yaml exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile \
     || cat /opt/nbwc/backups/Caddyfile.before-twc-cutover-$TS > /opt/nbwc/Caddyfile   # invalid: put the old file back, nothing was reloaded
   ```

5. **Smoke.** `bun scripts/smoke-cutover.ts --form <live-slug>` must print `smoke-cutover: ok`. It is
   GET-only, so it never stores a submission. By hand, once: open a live `/f/<slug>` and a live
   members review link in a browser.

6. **Legacy import** (BRIEF 10), if `sqlite3 /var/lib/twc-natasa/data/twc.db "select count(*) from legacy_members"`
   is 0: run the one-shot in `migration/briefs/data-import.md` (backup, `--dry-run`, then for real).
   Record **counts only** in `AUDIT-TASKS.md`.

7. **Stop nothing yet** (decision in `AUDIT-TASKS.md`): no timer or container is fully replaced by this
   step. Each one's release condition is listed there.

**Rollback:** `cat /opt/nbwc/backups/Caddyfile.before-twc-cutover-$TS > /opt/nbwc/Caddyfile` then the
same `caddy reload`. Note that 301s are cached by browsers, so a rollback won't reach a visitor whose browser already cached one.

**Later, `/f/*`** (after forms-import is deployed and its report shows every live form imported): paste
the body of `twc_forms_cutover` into the apex block (any skipped form → list the imported slugs instead
of the regexp), validate, reload, and smoke `/f/<slug>` → 301 `new.*/f/<slug>`. Old forms pieces
(`twc-site-forms`, `forms`, `twc-form-connections`, `notify-confirmations`) keep running for
`thanks-*`, waitlist, `event.ics`, `/f/media/*`, `/forms`, places/beacon/resume and stale POSTs.
