# Workstream: crm-admin-parity (phase 3)

Continues phases 1–2 (search, notes, CSV, filters, member details, neighbourhood
correction). Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, and remaining
`owner: "admin-inbox"` todos.

## Already on main (do not regress)

Phases 1–2 behaviours; approve/decline + welcome email; inbox store-then-email +
archive; member reviews; form responses; Better Auth.

## Build now (phase 3) — pick the highest leverage of:

1. **Duplicate detection** for applications/members by email (and optional soft merge /
   link UI if the schema already supports it via `legacy_members` / `user_id`). Do not
   invent a full people-alias graph unless a small table clearly helps.
2. **Read / unseen marks** for inbox or applications if the old CRM had them and they
   unblock day-to-day use — otherwise mark retired with evidence.
3. **Logged admin actions** (approve/decline/note/neighbourhood) as an append-only audit
   list on `/admin` if cheap (migration **0007_admin_actions.sql**). Skip if it balloons.
4. **Person / member summary strip**: newsletter consent state from
   `newsletter_subscribers`, linked application count, member-since — read-only chips on
   the member Details panel (no new CRM mirror).

Still out of scope: form builder, Spotlight, Notion, Hermes, webhooks, SSE, Classic/Bento,
spam-release (OPS-522), enabling `twc_admin_cutover` / `twc_crm_cutover` (integrator).

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only. Manifest →
`built` with evidence. Update `AUDIT-TASKS.md`.
