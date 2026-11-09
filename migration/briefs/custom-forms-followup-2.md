# Workstream: custom-forms follow-up (phase 2)

Continues phase 1 (open/close, overview, CSV). Read `migration/BRIEF.md`,
`AGENTS.md`, `AUDIT-TASKS.md`, `src/features/forms/*`, CRM-104–127 (builder) and
CRM-101 / thank-you / hold inventory only as far as this phase needs.

## Already on main

Public `/f/<slug>`, submit API, import, admin Form responses with open/close + CSV.

## Build now (phase 2) — highest leverage, not the full builder

1. **Minimal form editor on `/admin` (CRM-104 light):** create / edit a custom form
   enough to publish something live without the old CRM:
   - fields: name, slug, intro, thanks, closed_message, open, one_per_email
   - questions: reuse `checkQuestions` / `saveForm` — support the question types
     the public renderer already handles (do not invent new widget types)
   - version bump through existing `saveForm` rules
   - delete or archive only if schema already supports it safely; otherwise skip
2. **Hold / soft-hide a response (CRM-135 light)** only if cheap with current
   `form_responses` columns; otherwise leave todo.
3. Mark CRM-104–106 (and neighbours you truly cover) `built` with honest evidence.
   Leave full Classic editor parity, file uploads, waitlist, resume, embed,
   schedule (CRM-101) as todo.

Still out of scope: `/f/media/*`, event calendar, Notion/webhooks, enabling
`twc_forms_cutover` until a real form exists on the VPS.

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only.
Manifest + `AUDIT-TASKS.md` updated. Do not push.
