# Workstream: crm-admin-parity (phase 2)

Continues from phase 1 (`migration/briefs/crm-admin-parity.md`, merged: search, notes `0006`, CSV).
Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, and remaining `owner: "admin-inbox"`
`todo` items in `migration/manifest.json`.

## Already on main (do not regress)

Phase 1 search / notes / CSV; applications approve/decline + welcome email; members status;
inbox store-then-email + archive; member reviews; form responses; neighborhoods; bookings;
gatherings. Better Auth (not old CRM password users).

## Build now (phase 2)

Pick the highest-leverage gaps that still block day-to-day CRM use on `/admin`. Prefer, in order:

1. **Application/member detail** that shows answers (and notes) without leaving the card —
   match what an admin needs to approve (CRM answer display / origin labels).
2. **Filters** on applications (status pending/approved/declined) and members (status),
   composable with the existing search box.
3. **Neighbourhood tags / assignment** on members if not already editable in the members card
   (CRM-042 class) — reuse existing neighborhoods data; no new geography facts.
4. **Decline reason / internal status notes** only if the old CRM exposed them and SQLite can
   hold them without inventing product copy — otherwise mark retired with evidence.
5. Anything else clearly required to stop using `crm.*` for applications+members review,
   excluding: form builder, Spotlight, Notion, Hermes, webhooks, SSE, Classic/Bento themes,
   people-alias graph, spam-release (OPS-522).

Migration number: next free after `0006` → **`0007_*.sql`** only if a new table/column is required.

## Still out of scope

- Enabling `twc_admin_cutover` / `twc_crm_cutover` (integrator decides after this lands + smoke).
- Custom-forms builder, notifications rest, `/f/*` Caddy enable.

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only. Manifest items you
finish → `built` with evidence. Update `AUDIT-TASKS.md`.
