# Workstream: migration ceiling — custom forms (inventory)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`. **0 live custom forms**;
engine + editor + open/close + CSV already verified. OPS-518 stays todo.

## Decision (integrator)

Advanced Classic form features are **out of this migration** until a live form
needs them. Retire → `verified` + `target: retired` with evidence:

- show/hide, steps, composites, thank-you variants/redirect, places/funnel/waitlist
- file uploads + `/f/media/*` + file-size guard
- resume / finish-later form side
- embed, `/forms` list, hold/delete-for-good, Summary cards
- mis-seeded join limit OPS-059 if still custom-forms
- confirmation email *hooks* that need notifications product (leave CRM-125 /
  OPS-503… todo only if notifications still owns the send — else retire form side)

**Do not retire** if clearly already true — flip to verified instead.
Leave CRM-101 schedule/max_responses as `todo` (small product; optional peer brief).

Commit on worktree only; do not push. Report retired/left.
