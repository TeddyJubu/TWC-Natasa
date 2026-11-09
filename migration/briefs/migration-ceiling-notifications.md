# Workstream: migration ceiling — notifications (inventory)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`. Alerts + submitter
confirmations + Beehiiv consent gate already verified. Hermes/Notion/webhooks
retired and stopped.

## Decision (integrator)

These are **out of this migration** — retire → `verified` + `target: retired`:

- finish-later email suite (OPS-494/496/497/512–516 and peers)
- pitch emails
- bulk / site Beehiiv list sync / admin push (CRM-152/154/183/184, OPS-198/…)
- notify_settings editable UI + test-send (CRM-136/138/139/142, OPS-364/498/…)
- custom-form confirmation copy editor (CRM-141) — in-app fixed thank-you is enough
- event-block / show-hide notification chrome (OPS-235/427)
- email lowercasing polish (OPS-107) unless already true — flip if true

Flip already-true leftovers. Leave nothing as todo unless a hard product dependency
for day-to-day join/contact/review/spotlight.

Commit on worktree only; do not push. Report retired/left.
