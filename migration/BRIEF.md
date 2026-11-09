# Migration brief — move TWC onto the new app

Shared brief for every migration workstream. Read `AGENTS.md`, `DESIGN.md`, `README.md`,
`AUDIT-TASKS.md` and this file before writing code. Owner decisions are already made — do not ask.

## Goal

Make `https://new.thewomenscollective.club` (and later the apex, with `/` kept as coming-soon) the
one home for: the old static site, the CRM, and the intake/forms back office. When parity is
verified, archive old pages (never delete), 301 their URLs, and stop the old timers/containers.

## Inputs (local, gitignored)

- Legacy code snapshot (no secrets, no real PII): `.migration/legacy/`
  - `site/`, `crm/`, `intake/`, `tools/`, `compose.yaml`, `Caddyfile`, `testdata/`, `submissions.py`, `custom_forms.py`
- Inventories: `.migration/inventory/`
  - `backoffice.md` — OPS-001… (392 items; Part D gap for `tools/forms/*` + notify-confirmations/resume)
  - `site.md` — SITE-* (to be written)
  - `crm.md` — CRM-* (to be written); live CRM serves Classic at `/` (default) and Bento at `/v2` (same API)
- Made-up samples only: `.migration/legacy/testdata/` — never copy real personal data off the VPS

## Owner decisions (do not re-ask)

1. Coming-soon page stays: only apex `/` from old `site/index.html`.
2. Every other old page is archived on the VPS; its URL 301s to the matching new page.
3. Old pages to archive/redirect: about, contact, directory, events, fellowship, partnerships,
   editing, privacy, terms, code-of-conduct, message-sent, subscribed, thanks-*, and 404.
4. Build missing public pages in the scrapbook kit (`src/app/twc.css`, `AppNav`/`AppFooter`) first
   (fellowship, partnerships, …). Never invent `[BRACKETED]` facts — drop the element.
5. `/account` keeps its current design. Do not restyle it.
6. Every other page matches the new system: public = scrapbook; internal = app shell (like `/account`).
7. CRM is rebuilt inside `/admin` (app shell). Feature parity required. SQLite is the single source of truth.
8. After parity: `crm.*`, `admin.*`, `members.*`, and `join.*` forms redirect to the new app; then stop old timers/containers.
9. New `/contact` messages are stored in the database (and emailed), so they show in the admin inbox.
10. Legacy import (VPS only): 128 applications, 120 members, 44 newsletter subscribers, `submissions.jsonl`.
    Imported members without a login match on email at sign-up; they never self-approve.
11. VPS changes allowed on TWC blocks in `/opt/nbwc/Caddyfile` and TWC services in `/opt/nbwc/compose.yaml`
    only. Backup with timestamp first; `caddy validate` before reload. Never touch Vantrix, Hermes,
    studio, natasatuohy.com, buzz, or nbwc.site blocks.
12. Fix known legacy bugs in the rebuild (do not port them):
    - `members.*/join` and `admin.*` still serve the old form / write the old file
    - Decline exists only in the CRM internal API
    - Approve/archive can hit the wrong record when `record_id` is missing
    - Review tokens stored plaintext in `staging_links.txt`
    - Some file rewrites have no locking
    - Beehiiv sync ignores `email_subscription_consent`

## Manifest & gate

- `migration/manifest.json` — one entry per inventory item:
  `{ id, source, target | "retired", acceptance, owner, status, evidence }`
  `status`: `todo` → `built` → `verified`
- `scripts/migration-check.ts` exits non-zero if any item is not `verified`, or if any old URL in the
  snapshot has no redirect or route. Cutover only when it passes.
- Record every owner decision and improvisation in `AUDIT-TASKS.md`.

## Workstreams (`owner` field)

| owner | Scope |
|---|---|
| `public-pages` | Missing public pages + scrapbook polish; redirects map for old site URLs |
| `data-import` | Import scripts (testdata locally; VPS import of real counts); email match on sign-up |
| `admin-inbox` | Contact/partnership/newsletter inbox, applications review, notes, statuses, CSV |
| `members-links` | Members admin, review/update links, Spotlight; token hashing |
| `custom-forms` | Custom form engine parity needed for live forms |
| `notifications` | Emails, Notion, Beehiiv (respect consent), Hermes auto-approve, webhooks |
| `vps-cutover` | Caddy redirects, archive, stop timers; reversible backups |

## Coding rules (same as AGENTS.md)

- Server functions: `src/features/*/fns.ts` → lazy `*.server.ts` → `serve()` + `requireSession`/`requireMember`/`requireAdmin`.
- Body-taking routes go in `API_ROUTES` in `src/start.ts` with size + caller checks + tests.
- Secrets: `process.env` only in server modules; never print values.
- Migrations: next `db/migrations/NNNN_*.sql` only; never edit applied ones; add tests.
- Public reads only what `publicProfiles()` returns.
- Commit after every change. Push `main` only after typecheck, lint, tests and build all pass.
- Co-author trailers optional; do not push or open a PR unless the integrator asks.

## Definition of done (whole migration)

1. `bun run scripts/migration-check.ts` passes.
2. Final Haiku sweep of the whole manifest is green.
3. Live smoke test of every old URL passes.
4. Apex shows only coming-soon; every other old URL lands on the new site.
5. Old services stopped.
6. `AUDIT-TASKS.md` records what moved, what was retired, and why.
