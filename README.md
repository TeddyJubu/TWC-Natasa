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
- Supabase via Lovable Cloud: auth, Postgres with row-level security, storage. The browser talks to
  Supabase directly, so the database policies are the security boundary.
- Built for a Cloudflare Worker (`wrangler.jsonc`, `@cloudflare/vite-plugin` on build)
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
src/integrations/    generated Supabase/Lovable clients and types
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

### Secrets

`.env` is tracked on purpose: Lovable syncs `main` and needs its `VITE_` publishable values. So it,
and every other tracked file, holds **publishable values only** (the shape is in `.env.example`).
Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_CRON_SECRET`, any `sb_secret_…` key) go in
`.dev.vars` locally (gitignored) and in Wrangler secrets for deploys (`wrangler secret put NAME`).
`src/app/secrets.test.ts` fails the test suite if a tracked file contains a Supabase secret key, a
`service_role` JWT, or a value for either secret.

Follow-up: there is no `sitemap.xml` yet; generate one from the live routes once `VITE_SITE_URL` is
set in production.

## Scripts

| Script | What it does |
|---|---|
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run test` | Vitest (unit and route tests, jsdom) |
| `bun run test:db` | Database migrations + row-level-security checks (`drizzle/test/run.sh`, below) |
| `bun run build` | Production build (Cloudflare Worker output) |
| `bun run check` | typecheck + lint + test + build |
| `bun run deploy` | `vite build && wrangler deploy`, a manual deploy outside Lovable (needs Cloudflare login) |

## Database tests

```sh
bun run test:db    # or drizzle/test/run.sh
```

Starts a throwaway local Postgres, loads Supabase stubs, applies every migration in
`drizzle/migrations/` and runs the row-level-security checks in `drizzle/test/rls.sql`. It needs the
local Postgres binaries (`initdb`, `pg_ctl`, `psql`) on `PATH` and ends with `all checks passed`.

## Database & go-live

### Migration workflow

Migrations are **hand-written SQL**. Drizzle is kept only as the runner: `drizzle-kit`, `drizzle-orm`,
`postgres` and `drizzle.config.ts` stay because Lovable's migration runner most likely applies the
folder with `drizzle-kit migrate` (`drizzle.config.ts` reads `LOVABLE_DB_MIGRATION_URL`).

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

**Go-live order.** The code on this branch relies on tables, functions and policies from migrations
0001–0003 (members-only access, applications, neighborhoods, `public_profiles()`, `is_admin()`, the
review triggers). Deploying the code before the database has them breaks the directory, `/join`,
`/account` and `/admin`. So:

1. Apply `0001_members_only_admin.sql`, then `0002_public_profiles.sql`, then `0003_admin_review.sql`,
   in that order, to the Lovable Cloud database (SQL editor).
2. Have Lovable regenerate `src/integrations/supabase/types.ts`, then remove the `BRIDGE` hand-patches
   that stood in for the new tables and functions.
3. Deploy the code: merge to `main` (Lovable syncs and publishes it).

Notes: `0000_migration.sql` is the schema already live. 0001 creates the `avatars` and
`neighborhood-logos` storage buckets, so there's no manual bucket step. 0003 runs a one-time backfill
when it's applied. Run `drizzle/test/run.sh` before applying, to catch a broken migration locally.

## First admin

Admins can't be created from the app; the first one is added by hand, once:

1. Sign up on the site and confirm the email.
2. In the Lovable Cloud SQL editor, look up the account's id:
   `select id from auth.users where email = '…';`
3. Grant the role:
   `insert into public.user_roles (user_id, role) values ('<uuid>', 'admin');`
4. Sign out and back in. An **Admin** link to `/admin` now appears in the account nav.
