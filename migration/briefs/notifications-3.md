# Workstream: notifications (phase 3)

Continues phases 1–2. Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`,
`src/server/notify.ts`, `src/server/email.ts`, and remaining
`owner: "notifications"` todos (CRM-136–147, confirmation / finish-later OPS).

## Already on main

- `subscribeIfConsented`, `notifyAdmins`
- Admin alerts: contact, partnership, application, review, Spotlight
- Welcome email on application approve

## Build now (phase 3)

1. **Confirmation email to the applicant** after a successful `/join` application
   store (CRM-137 / matching OPS if present): short thank-you, no admin-only
   links, failure logs only — never fails the store. Reuse `sendEmail()`.
2. **Confirmation email after contact / partnership** submit if not already sent
   (check `receiveMessage`); add only what's missing.
3. Do **not** build Hermes, Notion, outbound webhooks, per-form `notify_settings`
   UI, finish-later resume emails, or bulk Beehiiv re-sync in this phase — leave
   those `todo` with AUDIT notes.
4. Mark matching inventory items `built` with evidence.

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only.
Update manifest + `AUDIT-TASKS.md`. Do not push.
