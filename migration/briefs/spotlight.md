# Workstream: Spotlight (members-links follow-up)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md` (members-links follow-up),
`src/features/member-links/**`, migration `0003_member_links.sql`, and manifest items
CRM-037/083/097 and OPS-028/029/049/115.

## Already on main

Hashed single-use review links (`purpose` column already accepts values; review lookups
filter on purpose). Public `/review?t=` + `POST /api/review`. Admin mint/revoke.

## Build now

1. **Spotlight purpose links:** mint with `purpose = 'spotlight'` from `/admin` (separate
   from review). Same hashing, expiry, single-use rules.
2. **Public Spotlight form** at `/review` (or a dedicated path if cleaner) when the token's
   purpose is spotlight — questions matching the old Weekly Spotlight shape from the
   inventory/legacy snapshot (made-up fixtures only; never invent member answers).
3. **Store answers** (reuse `member_reviews` with purpose, or a dedicated table via
   **`0008_*.sql`** if the review shape is a poor fit — document the choice).
4. **Admin listing** of Spotlight answers on `/admin`.
5. **Import** historical `spotlight_answers.jsonl` (synthetic fixture + VPS one-shot note),
   same pattern as forms/legacy import. Counts only in logs.
6. **CRM-090:** if still "agent never sees the link", leave `todo`/`built`-retired only with
   an AUDIT note that owner confirmation is still required — do not invent the retire.

## Out of scope

Form builder, notifications confirmation emails, Notion/Hermes, enabling admin/crm Caddy
cutovers, Beehiiv retry queue.

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only. Manifest items →
`built` with evidence. Update `AUDIT-TASKS.md`.
