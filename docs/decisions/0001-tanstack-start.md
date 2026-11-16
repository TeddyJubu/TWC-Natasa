# 0001. Stay on TanStack Start + Router

- Status: accepted (owner, 2026-11-16)
- Versions: `@tanstack/react-start` 1.169.4, `@tanstack/react-router` 1.170.46, `@tanstack/react-query` 5.107.1 (exact pins in `package.json`)

## Context

Nobody chose TanStack on purpose. It came with the Lovable starter: the first commit, `d1b9808` (2026-10-01), is
`template: custom_design_system_tanstack`, and no alternative was compared at the time.

On 2026-11-08, Phase 9 removed Lovable and Supabase (`26609b3`, `5d0f21a`, `9ccc691`, `d65e437`). The app
moved to one Node server on the VPS, with SQLite and Better Auth. Leaving TanStack would have meant rewriting
every route as well. Its full-stack layer, Start, already did what Supabase had been doing.

## Decision

Keep TanStack Start, TanStack Router and TanStack Query. Here is what the app relies on:

- **Server functions** (`src/features/*/fns.ts`) took over from Supabase's client queries. The
  `requireSession`/`requireMember`/`requireAdmin` guards inside them took over from Supabase's row-level
  security rules (RLS) (`src/server/guard.ts`, checked by `src/server/policy.test.ts`). The browser never
  touches the database.
- **Server routes** handle the endpoints that take a body (`src/routes/api/*`). They check the size and the
  caller before reading the body.
- **Request middleware** in `src/start.ts` runs the CSP nonce, the security headers and the CSRF check.
- **SSR with route loaders**: public pages put public member cards and events in the server's HTML, which
  helps search engines.
- **File-based routes with layout segments**: `_authenticated` and `_admin` guard a whole subtree from one
  `route.tsx`.
- **One process**: `server.mjs` renders pages, serves static files and runs the server functions. That suits
  a single VPS with SQLite in one file.

## Consequences

- Start is younger than Next.js or Remix and changes quickly. Keep exact pins and upgrade on purpose, one
  minor release at a time, with the full suite run under Node 22 (the VPS's version).
- A custom Start instance replaces Start's default middleware. `src/start.ts` must keep `csrfMiddleware`,
  and every route that takes a body must be listed in `API_ROUTES`.
- The redirect guards in route layouts only control what people see. The security check stays in the
  server functions.

## Revisit when

- Start drops or breaks server functions or request middleware without a migration path, or
- a pinned version has a security fix that can't be taken without a large rewrite.
