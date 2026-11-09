# Workstream: custom-forms follow-up (phase 1)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, `migration/briefs/custom-forms.md`,
`src/features/forms/*`, and inventory CRM-099–CRM-103 / OPS open-close notes.

## Already on main

- Public `/f/<slug>` + `/f/<slug>/thanks`, submit API, honeypot, rate limits
- `custom_forms` / `form_responses` / `form_versions` via `saveForm`
- Import script + fixtures; VPS currently has **0** live custom forms
- `/admin` "Form responses" card: read-only list with open/closed chip and answers

## Build now (phase 1)

1. **Open / close switch (CRM-100):** on each form row in `/admin` › Form responses,
   an admin can open or close the form (`requireAdmin`). Closing keeps the public
   page reachable with `closed_message` (existing behaviour of `openForm`). Optional
   one-line edit of `closed_message` when closing is fine; do not invent schedule /
   response-limit UI yet (CRM-101 stays todo).
2. **Forms overview polish (CRM-099 / CRM-103 light):** the same card is the overview —
   show name, slug (`/f/…` link), open/closed, answer count, newest answer date.
   No separate Forms page, no nested Classic sidebar. Mark only what you actually ship.
3. **Responses CSV (CRM-130)** for one form if cheap: same CSV rules as applications
   (BOM, CRLF, quoted cells, formula-prefix). POST server fn → blob download. Skip if
   it balloons; leave todo with a note.
4. Update manifest + `AUDIT-TASKS.md`.

Still out of scope: full form builder (CRM-104–127), file questions + `/f/media/*`,
thank-you variants/redirect/waitlist/places, event calendar, embed, resume links,
held/delete-for-good, confirmation emails, enabling `twc_forms_cutover` (integrator;
still 0 live forms).

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only. Do not push.
