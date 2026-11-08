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
- Supabase (the owner's own project): auth (email + optional Google), Postgres with row-level security,
  storage. The browser talks to Supabase directly, so the database policies are the security boundary.
- Built as a Cloudflare Worker bundle (`wrangler.jsonc`, `@cloudflare/vite-plugin` on build) and served on
  our own VPS by `wrangler dev --local` (workerd) behind Caddy; see [Hosting](#hosting-and-deploy)
- Vitest + Testing Library + jsdom

History: the site was first built in Lovable and ran on Lovable Cloud; both were dropped in November 2026.
- Vitest + Testing Library + jsdom

## Source layout

```
src/design-system/   tokens, components, effects (attachable; imports nothing from outside)
src/index.ts         the design-system barrel (`@/index`)
src/features/        domain modules: queries, mutations, mappers (members, events, neighborhoods,
                     applications, admin)
src/app/             app wiring: lazy Supabase client, auth events, route tests
src/routes/          pages (`_authenticated/` needs a session, `_authenticated/_admin/` an admin)
src/showcase/        preview-only specimens and demo members (/colors, /typography, /components)
src/integrations/    the Supabase client and generated types
drizzle/migrations/  hand-written SQL migrations; drizzle/test/ holds the RLS checks
```

## Develop

```sh
bun install
bun run dev        # http://localhost:8080
```

In a sandbox, bun may need writable temp and cache directories, e.g.
`BUN_TMPDIR=$TMPDIR BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache bun install`.

## Environment

| Variable | Required | What it does |
|---|---|---|
| `VITE_SITE_URL` | No | The site's public origin, e.g. `https://example.com` (no path; a trailing slash is fine). When set, every page gets an absolute `og:image` (the hero photo), and the indexable public pages (`/`, `/members`, `/join`, `/auth`; the list is in `src/app/seo.ts`) get an absolute `<link rel="canonical">` and `og:url`. Unset, or not a bare http(s) origin, means none of them are emitted, never a relative or guessed URL. |
| `CF_EMAIL_ACCOUNT_ID` | For approval emails | Cloudflare account id for the Email Sending API. Server only. |
| `CF_EMAIL_API_TOKEN` | For approval emails | Cloudflare API token with email sending permission. **Secret**: server environment only, never a tracked file. |
| `EMAIL_FROM` | No | Sender address for the approval email; defaults to `info@thewomenscollective.club`. |

| `VITE_GOOGLE_AUTH` | No | `true` shows "Continue with Google" on `/auth` (Supabase's native Google OAuth, back to `/auth`). Anything else, or unset, hides it. Enable the Google provider in Supabase first. |

When an admin approves an application (or a member, via her newest application), `/admin` calls the
`sendApprovalEmailFn` server function (`src/features/admin/approval-email.ts`). It acts with the admin's
own access token, requires `is_admin()` and an `approved` application, and sends one plain-text welcome
email linking to `${VITE_SITE_URL}/auth`. Declines never send. Without the two `CF_EMAIL_*` values (or
`VITE_SITE_URL`) nothing is sent and `/admin` shows "Approved — email not sent (email isn’t set up)".

### Secrets

`.env` is tracked on purpose: the server pulls `main` and builds with its `VITE_` publishable values. So
it, and every other tracked file, holds **publishable values only** (the shape is in `.env.example`).
Server secrets (`CF_EMAIL_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, any `sb_secret_…` key) go in a
gitignored `.dev.vars` at the repo root, locally and on the server: the build copies it next to the built
Worker (`dist/server/.dev.vars`), where `wrangler dev` reads it. `DATABASE_URL` (the Postgres connection
string, with its password) lives only in your shell while applying migrations.
`src/app/secrets.test.ts` fails the test suite if a tracked file contains a Supabase secret key, a
`service_role` JWT, or a value for any of those names.

`.env` sets `VITE_SITE_URL=https://thewomenscollective.club`. `public/sitemap.xml` lists the same indexable
pages on that domain and `public/robots.txt` points to it; `src/app/sitemap.test.ts` fails if the sitemap and
the canonical list in `src/app/seo.ts` drift apart.

## Scripts

| Script | What it does |
|---|---|
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run test` | Vitest (unit and route tests, jsdom) |
| `bun run test:db` | Database migrations + row-level-security checks (`drizzle/test/run.sh`, below) |
| `bun run build` | Production build (Cloudflare Worker output) |
| `bun run check` | typecheck + lint + test + build (CI runs the same, plus `test:db`; see below) |

Run the built Worker locally with `bunx wrangler dev --config dist/server/wrangler.json --local` (`vite
preview` can't serve this build).

## Hosting and deploy

The site runs on our VPS (Ubuntu): Caddy terminates TLS and proxies to `wrangler dev --local` (workerd),
serving `dist/server/wrangler.json`. **Deploying is merging to `main`**: the server pulls `main` within
five minutes, rebuilds (`bun install --frozen-lockfile && bun run build`) and restarts the Worker. The
server's `.dev.vars` holds its secrets (above); never commit them.

## CI

`.github/workflows/check.yml` runs on pull requests and on pushes to any branch except `main`:
`bun install --frozen-lockfile`, then typecheck, lint, test and build; a second job runs
`drizzle/test/run.sh` against a `postgres:17` service container.

## Database tests

```sh
bun run test:db    # or drizzle/test/run.sh
```

Starts a throwaway local Postgres, loads Supabase stubs, applies every migration in
`drizzle/migrations/` and runs the row-level-security checks in `drizzle/test/rls.sql`. It needs the
local Postgres binaries (`initdb`, `pg_ctl`, `psql`) on `PATH` and ends with `all checks passed`.
With `TEST_DB_EXISTING=1` it uses an existing server instead, via the libpq env (`PGHOST`, `PGPORT`,
`PGUSER`, `PGPASSWORD`, `PGDATABASE`). That server must be fresh, because the stub creates cluster-wide
roles. CI uses this mode; it is opt-in so a `PGHOST` set for other work is never touched.

## Database & go-live

### Migration workflow

Migrations are **hand-written SQL**, applied with `psql`, one file at a time, in order:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/migrations/0005_business_logo.sql
```

`DATABASE_URL` is the project's Postgres connection string (Supabase dashboard → Connect). Drizzle's
folder layout and journal are kept so `drizzle.config.ts` (which reads `DATABASE_URL`) still describes the
folder, but nothing runs `drizzle-kit` against the database.

- **Never run `drizzle-kit generate` or `drizzle-kit push`.** `drizzle/schema.ts` is intentionally
  empty, so `generate` would emit a migration that drops every table and `push` would drop them live.
- To add a migration:
  1. Write `drizzle/migrations/NNNN_short_name.sql` (next number, plain SQL).
  2. Append an entry to `drizzle/migrations/meta/_journal.json` with the next `idx`, the same
     `version`, a `when` later than the previous entry, `"tag": "NNNN_short_name"` (the file name
     without `.sql`) and `"breakpoints": true`.
  3. Add checks for every new table, policy, function or trigger to `drizzle/test/rls.sql`.
  4. Run `bun run test:db` until it ends with `all checks passed`.
- Schema changes reach the live database only when the owner applies them (see the go-live order below).

**Go-live order.** The code relies on every migration, 0000–0005 (base schema, members-only access,
applications, neighborhoods, `public_profiles()`, `is_admin()`, the review triggers, the optional
neighborhood, business logos). Deploying before the database has them breaks the directory, `/join`,
`/account` and `/admin`. So:

1. Run `bun run test:db` (catches a broken migration locally).
2. Apply each file to the owner's Supabase project, in order:
   ```sh
   for f in drizzle/migrations/0*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
   ```
   (On a database that already has some of them, start from the first one it lacks.)
3. Regenerate the types and drop the `BRIDGE` hand-patches they replace:
   `bunx supabase gen types typescript --db-url "$DATABASE_URL" --schema public > src/integrations/supabase/types.ts`.
4. Set `VITE_SUPABASE_*`/`SUPABASE_*` in `.env` to the project's publishable values, then merge to `main`.

Notes: 0001 creates the `avatars` and `neighborhood-logos` storage buckets, so there's no manual bucket
step. 0003 runs a one-time backfill when it's applied. In Supabase → Authentication → URL configuration,
set the site URL to `https://thewomenscollective.club` and allow `https://thewomenscollective.club/auth`
and `/reset-password` as redirect URLs.

## First admin

Admins can't be created from the app; the first one is added by hand, once:

1. Sign up on the site and confirm the email.
2. In the Supabase SQL editor (or `psql "$DATABASE_URL"`), look up the account's id:
   `select id from auth.users where email = '…';`
3. Grant the role:
   `insert into public.user_roles (user_id, role) values ('<uuid>', 'admin');`
4. Sign out and back in. An **Admin** link to `/admin` now appears in the account nav.
