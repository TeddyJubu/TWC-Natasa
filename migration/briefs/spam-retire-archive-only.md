# Workstream: spam — retire as archive-only

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md` (phase 1 spam deferral),
CRM-047/048/188, OPS-061/246/522.

## Decision (record in AUDIT)

The rebuild will **not** port mirrored spam verdicts or a Spam inbox view for
this cutover. Day-to-day triage is Needs attention (`new`) + Archived. Admins
archive junk; there is no spamcheck.py / forms spam_hook in the Node app.

Retire CRM-047, CRM-048, CRM-188, and matching OPS spam items with
`built` + `target: retired` and evidence `archive-only-inbox` (name the
replacement). Do **not** invent a spam column or rebuild `inbox_messages`
CHECK.

Leave OPS-522 as retired-with-care or todo only if it describes a live risk
the archive flow already avoids — prefer retire with evidence that junk is
archived, not silently dropped from Beehiiv without a verdict pipeline.

## Done when

Manifest + AUDIT updated; commit on worktree only; do not push.
