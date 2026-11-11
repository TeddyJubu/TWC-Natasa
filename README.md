# The Women’s Collective

The website and member area for The Women’s Collective: a marketing site, a membership application
(`/join`), a members directory (`/members`), a member account page (`/account`) and an admin area
(`/admin`) for reviewing applications, members, neighborhoods and headshot bookings.

**North star:** women entrepreneurs in Queens belong to a community that helps their businesses grow.
Metric: people who submit a completed membership application each month.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together and [AUDIT-TASKS.md](AUDIT-TASKS.md) for
open work. Rules for coding agents live in [AGENTS.md](AGENTS.md).

## Stack

- TanStack Start + TanStack Router (file-based routes in `src/routes/`) and TanStack Query
- React 19 + TypeScript
- Tailwind CSS v4 and the in-repo design system in `src/design-system/`, which app code imports only
  through the `@/index` barrel (ESLint-enforced)
- One Node server (`server.mjs`, srvx) that renders pages, serves `dist/client`, and runs every data read and
  write as a TanStack Start server function
- SQLite (`node:sqlite`) in one file, `${DATA_DIR}/twc.db`; uploads in `${DATA_DIR}/uploads/`
- Better Auth on the same database: email + password with email verification, optional Google
- Vitest + Testing Library + jsdom

History: the site was first built in Lovable on Lovable Cloud, then ran on a Supabase project; both were
dropped in November 2026 (Phases 8 and 9 in AUDIT-TASKS.md). The old member records live in Notion; the new database started empty.

## Source layout

```
src/design-system/   tokens, components, effects (attachable; imports nothing from outside)
src/index.ts         the design-system barrel (`@/index`)
src/features/        domain modules: fns.ts (server functions), *.server.ts (their server-only code),
                     queries, mutations, mappers (members, events, neighborhoods, applications, admin, auth)
src/server/          server-only core: db.ts, auth.server.ts, guard.ts (who may do what), media.ts, email.ts
src/app/             app wiring: auth client and events, layout, SEO, security headers, route tests
src/routes/          pages (`_authenticated/` needs a session, `_authenticated/_admin/` an admin),
                     plus /api/auth/* (Better Auth) and /media/* (uploads)
src/showcase/        preview-only specimens and demo members (/colors, /typography, /components)
db/migrations/       SQLite migrations, applied in order at startup
server.mjs           the production server
```

## Run locally

```sh
bun install
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local   # once; the server won't start without it
bun run dev        # http://localhost:8080 — creates ./data/twc.db on first request
```

Without Cloudflare email settings, verification and password-reset emails (with their links) are printed to the
dev server's console, so you can sign up and click through locally. To try the production build:

```sh
bun run build
APP_URL=http://localhost:8788 BETTER_AUTH_SECRET=$(openssl rand -base64 32) bun run start   # http://127.0.0.1:8788
```

In a sandbox, bun may need writable temp and cache directories, e.g.
`BUN_TMPDIR=$TMPDIR BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache bun install`.

## Environment

**Public (tracked `.env`, baked into the browser bundle at build time):**

| Variable | What it does |
|---|---|
| `VITE_SITE_URL` | The site's public origin, e.g. `https://example.com`. When set, every page gets an absolute `og:image` (`public/og-image.jpg`, a 1200×630 crop of the home hero, with its size and alt), and the indexable public pages (`/`, `/members`, `/join`, `/auth`; the list is in `src/app/seo.ts`), each active neighborhood and each public member page get an absolute canonical and `og:url`, and the JSON-LD that needs absolute URLs. Unset or invalid means none of them, never a guessed URL. |
| `VITE_GOOGLE_AUTH` | `true` shows "Continue with Google" on `/auth`. Anything else, or unset, hides it. Set the two `GOOGLE_*` server values first. |

**Server (never in a tracked file):** set them in the service's environment or in `.env.local` at the repo root
(gitignored; `bun run start` and `bun run dev` read it). The shape is in `.env.example`.

| Variable | Required | What it does |
|---|---|---|
| `APP_URL` | Yes | The public origin, e.g. `https://thewomenscollective.club`. Links in emails use it, and Better Auth trusts it as the only origin (plus `http://localhost:8080` outside production). |
| `BETTER_AUTH_SECRET` | Yes | **Secret**, at least 32 characters: `openssl rand -base64 32`. Signs sessions and tokens; the server refuses to start without it (in every environment, tests included). Changing it signs everyone out. |
| `DATA_DIR` | No | Where `twc.db` and `uploads/` live; default `./data`. |
| `NODE_ENV` | On the server | `production`: without Cloudflare email settings, emails are skipped (not printed). |
| `HOST`, `PORT` | No | Where `bun run start` listens; default `127.0.0.1:8788`. |
| `CF_EMAIL_ACCOUNT_ID` | For email | Cloudflare account id for the Email Sending API. |
| `CF_EMAIL_API_TOKEN` | For email | **Secret.** Cloudflare API token with email sending permission. |
| `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | For the newsletter | **Secret** (the first). Both set lets an application that ticked the newsletter and email-consent boxes subscribe the applicant. Without them nothing is sent. |
| `EMAIL_FROM` | No | Sender address; defaults to `info@thewomenscollective.club`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Google | **Secret** (the second). Both set turns on Google sign-in. In Google Cloud, allow the redirect URI `${APP_URL}/api/auth/callback/google`. |

Emails (all through `sendEmail()` in `src/server/email.ts`, Cloudflare Email Sending): the email-verification link
on sign-up, the password-reset link, and the welcome email when an admin approves an application (or a member,
via her newest application). Declines never send. Without the two `CF_EMAIL_*` values nothing is sent and `/admin`
says "Approved — email not sent (email isn’t set up)". Every admin also gets an email when a contact message, a
partnership inquiry or a member review arrives (the review alert names the member and their choice, never the answers).

Newsletter: `subscribeIfConsented()` (`src/server/beehiiv.ts`) is the only way to Beehiiv. It needs an explicit `true`,
skips any address already in `newsletter_subscribers` (the imported list has `consent` null and is never re-sent) and
never asks Beehiiv to reactivate someone who left. Applications need the newsletter answer **and** the email consent.

`src/app/secrets.test.ts` fails the test suite if a tracked file assigns a value to `BETTER_AUTH_SECRET`,
`CF_EMAIL_API_TOKEN` or `GOOGLE_CLIENT_SECRET`, or if `.env` holds anything but `VITE_` values.
`src/app/sitemap.test.ts` keeps `public/sitemap.xml` in step with the canonical list in `src/app/seo.ts`.

## Scripts

| Script | What it does |
|---|---|
| `bun run dev` | Dev server on http://localhost:8080 |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run test` | Vitest: unit, route, server-function and access-rule tests (in-memory SQLite) |
| `bun run build` | Production build: `dist/server/server.js` + `dist/client/` |
| `bun run start` | Production server (`node server.mjs`) on `HOST:PORT` |
| `bun run check` | typecheck + lint + test + build (CI runs the same) |

## Database

SQLite through Node's built-in `node:sqlite` (Node 22.13 or newer). `src/server/db.ts` opens
`${DATA_DIR:-./data}/twc.db` (WAL, foreign keys on, 5 s busy timeout) and, at startup, applies every
`db/migrations/NNNN_name.sql` newer than `PRAGMA user_version`, each in its own transaction.

To change the schema: add `db/migrations/NNNN_short_name.sql` (next number, plain SQLite), never edit an applied
one, and cover what it changes with a test (access rules go in `src/server/policy.test.ts`). Tests run every
migration against an in-memory database.

Who may read or write what is **not** in the database: it is the server functions' domain code (the
`*.server.ts` modules), each starting with `requireSession`, `requireMember` or `requireAdmin` from
`src/server/guard.ts`. The database keeps integrity: foreign keys, CHECK constraints and the triggers that don't
depend on who acts (see `0001_init.sql`).

## Hosting and deploy

The site runs on our VPS (Ubuntu 24.04, Node 22): Caddy terminates TLS and proxies to the Node server at
`172.18.0.1:8788` (the Docker bridge address, so Caddy's container can reach it).

**Deploying is merging to `main`.** Every 5 minutes `twc-natasa-deploy.timer` runs `/usr/local/sbin/twc-natasa-deploy`:
it fast-forwards `/opt/twc-natasa` to `origin/main`, then `bun install --frozen-lockfile`, typecheck, tests and build.
Any failure stops there and the running site is untouched (a failed commit is tried once; the next push retries).
On success it snapshots the database to `/var/backups/twc-natasa/pre-deploy-*.db` (newest 20 kept) and restarts
`twc-natasa.service`, then checks the site answers (`GET /healthz`, which opens the database and is the one page
open behind the PIN). Migrations apply themselves when the server starts. Logs:
`journalctl -u twc-natasa-deploy` and `journalctl -u twc-natasa`.

Layout on the VPS:

```
/opt/twc-natasa                  checkout of main (the service's working directory)
/etc/twc-natasa/app.env          server env: APP_URL, DATA_DIR, BETTER_AUTH_SECRET, CF_EMAIL_*, EMAIL_FROM, HOST,
                                 PORT, NODE_ENV, SITE_PIN (root:www-data, 640)
/var/lib/twc-natasa/data/twc.db  the database (+ -wal/-shm while running); uploads/ beside it
/var/backups/twc-natasa/         pre-deploy snapshots, nightly-*.db and uploads-*.tgz (30 days)
```

`twc-natasa.service` runs `node server.mjs` as `www-data` on `172.18.0.1:8788` (the Docker bridge, so Caddy's
container can reach it; nothing else can). Caddy's `thewomenscollective.club` block in `/opt/nbwc/Caddyfile`
proxies to it; only the CRM's embeddable forms (`/embed.js`, `/f/*`, their assets) and the legal pages (`/privacy`,
`/terms`, `/code-of-conduct`) are still served from the old static site there. `new.` and `join.…/join` redirect here. Traffic arrives through Cloudflare, then Caddy, so rate limits (Better Auth's and the per-IP limit on
applications) key on `CF-Connecting-IP`, falling back to `X-Forwarded-For`. Someone who reaches Caddy directly
(bypassing Cloudflare) can spoof that header, which only lets them dodge the rate limits.

### Private preview (site PIN)

While `SITE_PIN` is set in `app.env`, every request — pages, `/api`, `/media`, static files — needs the PIN first
(`src/server/site-pin.ts`, run first in `server.mjs`). The PIN page posts to `/__pin`, which sets an HttpOnly cookie
holding a hash of the PIN for 30 days and returns the visitor to the page she asked for (so emailed links still work
after the PIN). Only the icons and `/healthz` are open. Changing the PIN signs everyone out of the preview; removing
it (and restarting `twc-natasa.service`) opens the site. The PIN lives only in `app.env`: this repository is public.

### Backup

`twc-natasa-backup.timer` copies the database with SQLite's online backup and tars the uploads every night at
04:15 UTC, keeping 30 days. By hand:

```sh
sqlite3 /var/lib/twc-natasa/data/twc.db ".backup '/var/backups/twc-natasa/manual-$(date +%F).db'"
```

Restore: `systemctl stop twc-natasa`, copy the backup over `twc.db` (delete `twc.db-wal`/`-shm`), put the uploads
back, `systemctl start twc-natasa`.

## First admin

Admins can't be created from the app; the first one is added by hand, once:

1. Sign up on the site and confirm the email.
2. On the server: `sqlite3 /var/lib/twc-natasa/data/twc.db "insert into user_roles (user_id, role) select id, 'admin' from \"user\" where email = 'you@example.com';"`
3. Reload `/account`. An **Admin** link to `/admin` now appears in the account nav.

## CI

`.github/workflows/check.yml` runs on pull requests and on pushes to any branch except `main`:
`bun install --frozen-lockfile`, then typecheck, lint, test and build.
