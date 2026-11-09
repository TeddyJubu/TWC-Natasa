# Workstream: crm-admin-parity (phase 1)

Unblocks `twc_admin_cutover` / eventually stopping intake+CRM for day-to-day review.
Read `migration/BRIEF.md`, `AGENTS.md`, CRM inventory (`migration/inventory/crm.md` if present,
else `.migration/inventory/` / manifest `owner: "admin-inbox"`), and the existing `/admin`
panels in `src/features/admin/`.

## Already on main (do not regress)

- Applications list + approve/decline + welcome email
- Members list + status (approve syncs newest application)
- Inbox (contact/partnership), member reviews, form responses, neighborhoods, bookings, gatherings
- Better Auth (not the old CRM password users)

## Build now (phase 1 — highest leverage)

1. **Admin search** across applications + members (name/email/business), case-insensitive, with
   tests. Prefer one search box that filters the existing cards (CRM-041 class of items).
2. **Admin notes** on an application or member (SQLite table + `requireAdmin` CRUD; show on the
   detail/row). Migration = next free number after `0005` → **`0006_admin_notes.sql`**.
3. **CSV export** of applications and of members (admin-only download; no PII in logs; columns
   match what `/admin` already shows).
4. **Spam / archive actions** for inbox rows that are still `new` (and document that OPS-522
   "release held spam" stays deferred if the old hold model isn't ported yet).
5. Flip finished manifest items (`owner: admin-inbox`) to `built` with evidence. Record
   improvisations in `AUDIT-TASKS.md`.

## Out of scope (later phases)

- Full Classic/Bento CRM UI parity, Notion/Hermes/webhooks, custom form builder, Spotlight,
  people-alias graph, live SSE. Do not enable `twc_admin_cutover` / `twc_crm_cutover` yet.

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only.
