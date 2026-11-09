# Workstream: VPS stop intake + crm (+ retired timers)

Read `migration/BRIEF.md`, `AGENTS.md`, AUDIT stop-readiness from vps-cutover
remainders.

## Decision (integrator)

Accept loss of stale `/join/thanks` and `/review/thanks` POSTs still aimed at
intake, and retire OPS-156 with intake. New mint is `/admin`. Hermes / Notion /
webhook product already retired — stop their timers too.

**Do not stop** forms / `twc-site-forms` / `notify-confirmations` / anything
serving a live form until OPS-518. Leave crm-test alone (CRM-006/OPS-279).

## Do now (on VPS `root@72.61.9.27`)

1. Snapshot compose + note running units.
2. Stop intake + crm containers (and Hermes/Notion/webhook timers if present).
3. Confirm admin/crm/join/review/spotlight still smoke-green via
   `bun scripts/smoke-cutover.ts` from the app host or curl checks.
4. Flip stop/timer manifest items that are now true; flip OPS-156 → verified
   (retired with intake). Update AUDIT.

Commit on worktree only if inventory-only; integrator may push after VPS.
Do not enable `twc_forms_cutover`.
