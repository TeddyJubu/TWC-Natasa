# Workstream: notifications (phase 2)

Continues the first notifications slice (`subscribeIfConsented`, `alertReview`,
`notifyAdmins`). Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`,
`src/server/notify.ts`, `src/server/beehiiv.ts`, `src/server/email.ts`, and
remaining `owner: "notifications"` todos in `migration/manifest.json`.

## Already on main

- `subscribeIfConsented()` — consent must be exactly `true`
- `alertReview` after a successful member review store
- Welcome email on application **approve** (not decline)
- Shared `notifyAdmins()` / `sendEmail()`

## Build now (phase 2) — pick all that fit cleanly

1. **Admin alert on new application** (after `POST /api/applications` stores the
   row): short subject + link to `/admin#applications`. No answer dump. Failure
   logs only — never fails the application. Mirror `alertReview`.
2. **Admin alert on new Spotlight answer** (after `POST /api/spotlight` stores):
   subject + link to `/admin#spotlight` (or the card id used). Same failure rule.
3. **Admin alert on new contact / partnership inbox message** if not already
   covered by the existing contact flow — check `src/features/contact` and
   partnerships; add only what's missing.
4. Mark matching OPS/CRM notification inventory items `built` with evidence.
   Retire items that are clearly Hermes / Notion / webhook / per-form CRM
   notify_settings UI **only** when this phase cannot ship them — leave those
   `todo` with an AUDIT note rather than half-claiming.

Still out of scope: Hermes auto-approve, Notion mirror, outbound webhooks,
finish-later / confirmation email templates with full CRM notify_settings UI,
Beehiiv sync of the entire imported list.

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only.
Update `migration/manifest.json` and `AUDIT-TASKS.md`. Do not push.
