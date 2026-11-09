# Workstream: custom-forms remainders (inventory)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, remaining
`owner: "custom-forms"` todos (~89).

## Already on main

`/f/<slug>`, open/close, CSV, minimal admin editor (CRM-104–106/117–119 verified).

## Do now

1. Verify/retire inventory that the editor + public engine already cover.
2. Retire Classic form-builder chrome, WebMCP-on-forms, Notion-on-forms, and
   features explicitly deferred (waitlist/resume/embed/file uploads/schedule)
   **only** with `target: retired` and evidence that cutover does not need them
   — or leave `todo` if they are still desired product. Prefer retire for
   Classic-only UI; leave product gaps (`CRM-101`, file questions, resume) as
   `todo` with a short AUDIT note.
3. OPS-518 / `/f/*` cutover stays `todo` until a live form exists on VPS.

No large builder rewrite. Commit on worktree only; do not push.
