# Workstream: crm-admin-parity (phase 6)

Continues phases 1–5. Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`,
`migration/inventory/crm.md`.

## Already on main

Full day-to-day `/admin`: search, notes, CSV, filters, Details, duplicates,
activity log, logged actions, newsletter card, Spotlight, approve/decline/undo,
form open/close + per-form CSV. Better Auth.

## Build now (phase 6)

1. **Inbox polish (CRM-063 light, no spam):** keep Needs attention = `status=new`.
   Add an **Archived** toggle or filter on the Inbox card (list `archived` messages;
   archive already exists). Do **not** port peek panels, keyboard nav, or Spam view
   (spam still deferred). Update CRM-063 evidence accordingly — `built` only if the
   acceptance can honestly say the rebuild's inbox covers day-to-day triage without
   Classic's Everything/Spam/peek; otherwise leave `todo` with an accurate partial note.
2. **Retire obsolete CRM API / mirror inventory** (manifest `built` + `target: "retired"`
   + evidence naming the replacement). Only when clearly about the *old* CRM, not a
   missing product feature:
   - Unified items API / counts / kinds: **CRM-027, CRM-035, CRM-043–CRM-050** (and
     **CRM-010** unknown `/api/*` if Start already returns JSON 404 for unknown API).
   - **CRM-044, CRM-045** if they are old CRM DB hygiene / untrusted JSONL mirror rules
     superseded by typed imports + SQLite.
   - **CRM-039** aliases-at-mirror-time — retire if merge/aliases stay out of scope
     (same decision as CRM-074–079); do not invent an alias graph.
3. **CRM-064** — mark `built` with evidence for the pieces that exist (neighborhood
   edit, approve/decline/undo, notes, logged actions) and name what is still missing
   (spam tag UI) in evidence; or leave `todo` if that would half-claim.

Still out of scope: merge/aliases UI (CRM-074–079), people table (CRM-038), spam
verdicts, form builder, Notion/Hermes/webhooks, enabling cutover snippets.

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only.
Manifest + `AUDIT-TASKS.md` updated. Do not push.
