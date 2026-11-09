# Workstream: crm-admin-parity (phase 5)

Continues phases 1–4. Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`,
`migration/inventory/crm.md` (CRM-057/058/093 and the retire list below).

## Already on main (do not regress)

Search, notes, CSV, filters, Details + summary chips, neighborhood, duplicates,
admin activity (`0007`), Spotlight answers, approve / decline / undo-decline with
confirm. Better Auth for admin access.

## Build now (phase 5)

1. **Logged actions (CRM-057, CRM-058):** things done *outside* the app (calls,
   meetings, headshot invites, emails, other), dated `YYYY-MM-DD`, note ≤ 1,000,
   `other` requires a note. Belong to a **member** (profile id) or, if she has no
   login yet, to an **application** by email — same two-subject pattern as notes
   (`0006`). Soft-remove (keep history) rather than hard-delete if cheap; a simple
   `removed_at` + append-only edit log is fine. UI: list + add/edit/remove under
   the member Details disclosure and under each application row. Migration **0009**.
   Do **not** fold these into `admin_actions` (0007 is in-app decisions only).

2. **Newsletter subscribers card (CRM-093):** read-only `/admin` card listing
   `newsletter_subscribers` (newest first): email, consent state
   (consented / no consent / imported-consent-unknown), source if stored, date.
   Search box already on the page can filter it client-side. No Beehiiv write from
   this card. Sidebar entry under Admin.

3. **Mark already-true items `built` with evidence (no new UI):**
   - **CRM-066 / CRM-067 / CRM-172:** decisions are domain functions on permanent
     UUIDs under `requireAdmin` (no intake hop, no shared key, no `record_id` slice).
   - **CRM-176:** SQLite transactions replace JSON read-modify-write.

4. **Retire with evidence (one AUDIT-TASKS bullet + manifest `retired`):**
   - Classic/Bento dual UI and theme prefs: **CRM-002, CRM-023, CRM-163, CRM-164,
     CRM-165** (rebuild = one `/admin` app shell; CRM-165 already notes retired).
   - CRM-own auth modes / sign-in / gates replaced by Better Auth:
     **CRM-014, CRM-017–CRM-022, CRM-179, CRM-180** (and CRM-013/015/016 if still
     todo and clearly about CRM password/caddy/access modes).
   - Live SSE / toasts / Classic keyboard peek: **CRM-009, CRM-166, CRM-167**
     (TanStack Query refetch on mutation is enough; no SSE).
   - Eight shared item statuses / hand-set matrix for a unified inbox:
     **CRM-051, CRM-052, CRM-053** (apps use three statuses; inbox is new/archived;
     check_duplicate is computed).
   - CRM-own SQLite mirror schema / process model / mounts / env that do not apply:
     **CRM-001, CRM-004, CRM-008, CRM-025, CRM-026** if still todo — only when the
     inventory text is clearly about the *old* CRM process, not a missing feature.

Still out of scope: merge/aliases (CRM-074–079), people table (CRM-038), spam,
timeline mega-panel (CRM-056), form builder, Notion/Hermes/webhooks, enabling
`twc_admin_cutover` / `twc_crm_cutover` (integrator).

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only.
Manifest updated for every item you touch. `AUDIT-TASKS.md` records decisions.
