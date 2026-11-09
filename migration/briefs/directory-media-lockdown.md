# Workstream: directory media lock-down

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, SITE-029 / SITE-118 /
SITE-167 in `migration/inventory/site.md`, and `src/server/media.ts` /
public member routes.

## Goal

Member portraits and neighbourhood logos served only under the rebuild's
visibility rules (`/media/*`, magic-byte checked uploads). Old apex/static
directory image URLs that still expose unpublished portraits must 404 or 301
to a safe target — never invent stand-in photos.

## Build

1. Confirm `/media/*` already enforces visibility; add tests if gaps.
2. Manifest SITE-029/118/167 → `built` or `verified` with evidence, or retire
   with evidence if the old static directory is already archived/redirected and
   only `/media/*` remains.
3. Do not SSH unless a Caddy tweak is clearly required for an old URL; prefer
   app-side 404.

## Done when

Checks green; commit on worktree only; do not push.
