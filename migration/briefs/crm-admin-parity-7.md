# Workstream: crm-admin-parity (phase 7)

Retirements + honesty for leftovers that day-to-day `/admin` will not get.
Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md` (esp. phase 3 merge
decision), `migration/inventory/crm.md`.

## Already on main

Admin day-to-day is largely there through phase 6 + form editor. Merge/aliases,
people table, and spam were repeatedly deferred.

## Do now (phase 7)

1. **Retire merge / aliases (CRM-074–CRM-081, CRM-039 if still built-not-verified)**
   with `built` + `target: "retired"` and evidence pointing at the phase-3 decision:
   decline the extra application + admin note; no alias graph; `applications.user_id`
   only via verified email claim. Do not invent merge UI or tables.
2. **Retire people table (CRM-038)** — member summary chips cover members; non-member
   people rows are not a product goal. Evidence that.
3. **Spam (CRM-047/048/188):** leave `todo` unless you can retire with evidence that
   archive-only inbox is the deliberate replacement *and* AUDIT already says spam
   waits on a verdict source — prefer leaving todo over half-retiring.
4. **CRM-056 timeline / CRM-170 item page:** retire or mark built-partial for the
   pieces that exist on card rows (notes, activity, logged actions, details) — be
   honest; do not claim Classic ItemView.
5. **Agent / WebMCP tools (CRM-156–159)** — retire if still todo (rebuild has no
   WebMCP agent surface; CRM-090 already retired).
6. **Classic/Bento chrome leftovers (CRM-162, 168, 170)** — retire with evidence of
   app-shell `/admin`.

No new migrations unless a one-line schema fix is required (it should not be).
No enabling `twc_admin_cutover` / `twc_crm_cutover` (integrator).

## Done when

Typecheck/lint/tests/build green (or untouched if JSON/md only); commit on the
worktree branch only; manifest + AUDIT updated. Do not push.
