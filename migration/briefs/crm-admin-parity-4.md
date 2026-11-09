# Workstream: crm-admin-parity (phase 4)

Continues phases 1–3. Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`,
`migration/inventory/crm.md` (CRM-068/069/070/071/174), and remaining
`owner: "admin-inbox"` todos.

## Already on main (do not regress)

Phases 1–3: search, notes, CSV, filters, member Details + summary chips, neighborhood
correction, email duplicates, admin activity (`0007`), Spotlight answers card.
Approve / decline already exist on Applications and All members (welcome email on
application approve). Better Auth; inbox archive.

## Build now (phase 4) — highest leverage first

1. **Approve / decline / undo-decline parity (CRM-068, CRM-069, CRM-174, BRIEF 12):**
   Confirm `/admin` can approve and decline applications **and** members with the same
   semantics the inventory requires (member record on approve, linked application updated,
   idempotent re-approve). Add **undo-decline → pending** if missing or incomplete, with
   confirmation in the UI (CRM-071). Do **not** invent Hermes auto-reject stamps or a
   separate `decline_undo` JSON blob unless the schema already has a place for them —
   `admin_actions` + status transitions are enough. Actor = the signed-in admin (already
   logged in 0007).
2. **Application native / hand statuses (CRM-030, CRM-070):** keep the three statuses the
   app already uses (`pending` / `approved` / `declined`). Map inventory values:
   - `archived` / `rejected` on import → already handled by import, or retire with evidence
     if the importer already maps them.
   - `check_duplicate` is a **computed** chip (phase 3), not a stored status — leave it.
   - `in_progress` / hand-`archived`: retire with evidence unless a one-line UI already
     fits (do not add a fourth status column without a clear day-to-day need).
3. **Inbox views polish (CRM-063) only if cheap:** Needs attention is already `status=new`.
   Do **not** port Spam / peek / keyboard navigation in this phase (spam still deferred).
   Mark CRM-063 `built` only for the parts that match, or leave `todo` with a note — do
   not half-claim the whole page.

Still out of scope: form builder, Notion, Hermes, webhooks, SSE, Classic/Bento,
spam-release (OPS-522), merge/link (CRM-074–079), enabling `twc_admin_cutover` /
`twc_crm_cutover` (integrator).

## Done when

Typecheck, lint, vitest, build green; commit on the worktree branch only. Manifest →
`built` (or `retired` with evidence) for every item you touch. Update `AUDIT-TASKS.md`
with decisions and improvisations.
