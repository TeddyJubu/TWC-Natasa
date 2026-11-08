# The Women’s Collective

The website and member area for The Women’s Collective: a marketing site, a membership application
(`/join`), a members directory (`/members`), a member account page (`/account`) and an admin area
(`/admin`) for reviewing applications, members, neighborhoods and headshot bookings.

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
dropped in November 2026 (Phases 8 and 9 in AUDIT-TASKS.md). `scripts/import-lovable.ts` moves the old data over.

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
scripts/             import-lovable.ts (one-off import of the old Supabase data)
server.mjs           the production server
```

## Run locally

```sh
bun install
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
| `VITE_SITE_URL` | The site's public origin, e.g. `https://example.com`. When set, every page gets an absolute `og:image`, and the indexable public pages (`/`, `/members`, `/join`, `/auth`; the list is in `src/app/seo.ts`) get an absolute canonical and `og:url`. Unset or invalid means none of them, never a guessed URL. |
| `VITE_GOOGLE_AUTH` | `true` shows "Continue with Google" on `/auth`. Anything else, or unset, hides it. Set the two `GOOGLE_*` server values first. |

**Server (never in a tracked file):** set them in the service's environment or in `.env.local` at the repo root
(gitignored; `bun run start` and `bun run dev` read it). The shape is in `.env.example`.

| Variable | Required | What it does |
|---|---|---|
| `APP_URL` | Yes | The public origin, e.g. `https://thewomenscollective.club`. Links in emails use it, and Better Auth trusts it as the only origin (plus `http://localhost:8080` outside production). |
| `BETTER_AUTH_SECRET` | Yes | **Secret.** Signs sessions and tokens: `openssl rand -base64 32`. Changing it signs everyone out. |
| `DATA_DIR` | No | Where `twc.db` and `uploads/` live; default `./data`. |
| `NODE_ENV` | On the server | `production`: without Cloudflare email settings, emails are skipped (not printed). |
| `HOST`, `PORT` | No | Where `bun run start` listens; default `127.0.0.1:8788`. |
| `CF_EMAIL_ACCOUNT_ID` | For email | Cloudflare account id for the Email Sending API. |
| `CF_EMAIL_API_TOKEN` | For email | **Secret.** Cloudflare API token with email sending permission. |
| `EMAIL_FROM` | No | Sender address; defaults to `info@thewomenscollective.club`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Google | **Secret** (the second). Both set turns on Google sign-in. In Google Cloud, allow the redirect URI `${APP_URL}/api/auth/callback/google`. |

Emails (all through `sendEmail()` in `src/server/email.ts`, Cloudflare Email Sending): the email-verification link
on sign-up, the password-reset link, and the welcome email when an admin approves an application (or a member,
via her newest application). Declines never send. Without the two `CF_EMAIL_*` values nothing is sent and `/admin`
says "Approved — email not sent (email isn’t set up)".

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

**Deploying is merging to `main`**: the server pulls `main` within five minutes, runs
`bun install --frozen-lockfile && bun run build`, and restarts the app service. Migrations apply themselves when the
server starts.

Layout on the VPS:

```
/srv/twc/app            checkout of main (the service's working directory: migrations are read from db/migrations)
/srv/twc/app/.env.local server environment (APP_URL, BETTER_AUTH_SECRET, CF_EMAIL_*, GOOGLE_*, DATA_DIR, HOST, PORT,
                        NODE_ENV=production); mode 600, owned by the service user
/srv/twc/data/twc.db    the database (+ twc.db-wal, twc.db-shm while running)
/srv/twc/data/uploads/  avatars/<member id>/…, neighborhood-logos/…
```

The service runs `bun run start` (that is, `node --env-file-if-exists=.env.local server.mjs`) in `/srv/twc/app`
with `HOST=172.18.0.1`, `PORT=8788` and `DATA_DIR=/srv/twc/data`, restarting on failure. Rate limiting reads the
client address from Caddy's `X-Forwarded-For`; the server only listens on the bridge address, so only Caddy can reach it.

### Backup

The database is one file; copy it with SQLite's online backup (safe while the server runs), plus the uploads:

```sh
sqlite3 /srv/twc/data/twc.db ".backup '/srv/twc/backups/twc-$(date +%F).db'"
rsync -a /srv/twc/data/uploads/ /srv/twc/backups/uploads/
```

Restore: stop the service, put the backup in place as `twc.db` (and the uploads back), start it.

## Import from Lovable (once)

`scripts/import-lovable.ts` loads a JSON export of the old Supabase project into an **empty** database (it refuses
otherwise), in one transaction, and prints counts. The JSON's keys: `users` (rows of `auth.users`), `identities`
(rows of `auth.identities`), and one key per public table (`profiles`, `user_roles`, `events`, `event_rsvps`,
`headshot_bookings`, plus `neighborhoods`/`applications` if present), each an array of rows with Postgres column
names. The shape is in `scripts/fixtures/lovable-export.json`.

```sh
DATA_DIR=/srv/twc/data node scripts/import-lovable.ts lovable-export.json
```

Users keep their id, email, created date and email confirmation; their bcrypt password still works (Better Auth
checks legacy `$2…` hashes with bcryptjs), and Google identities become Google accounts. Exported events replace the
seeded ones. A neighborhood that isn't in the table, or a portrait path outside the member's own folder, is cleared.
Files are not in the export: copy the old `avatars` and `neighborhood-logos` buckets into
`/srv/twc/data/uploads/avatars/` and `/srv/twc/data/uploads/neighborhood-logos/` (same paths as before).

## First admin

Admins can't be created from the app; the first one is added by hand, once:

1. Sign up on the site and confirm the email.
2. On the server: `sqlite3 /srv/twc/data/twc.db "insert into user_roles (user_id, role) select id, 'admin' from \"user\" where email = 'you@example.com';"`
3. Reload `/account`. An **Admin** link to `/admin` now appears in the account nav.

## CI

`.github/workflows/check.yml` runs on pull requests and on pushes to any branch except `main`:
`bun install --frozen-lockfile`, then typecheck, lint, test and build.
