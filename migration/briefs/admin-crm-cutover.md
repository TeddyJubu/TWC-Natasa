# Workstream: admin + CRM Caddy cutover (repo side)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, `migration/briefs/vps-cutover.md`,
`migration/caddy-twc-redirects.caddy`, `scripts/smoke-cutover.ts`.

## Context

Day-to-day `/admin` is in place (applications, members, inbox, forms editor,
Spotlight, notes, CSV, decisions). Merge/people/Classic chrome retired. Spam
stays deferred (archive-only). Integrator will enable the snippets on the VPS
after this repo work lands — **this workstream does not SSH**.

## Build now (repo only)

1. Confirm `(twc_admin_cutover)` and `(twc_crm_cutover)` in
   `migration/caddy-twc-redirects.caddy` match the intended 301 to
   `https://new.thewomenscollective.club/admin` (GET/HEAD-only if other cutovers
   use that pattern; document if admin/crm keep all-method 301).
2. Extend `scripts/smoke-cutover.ts` with checks for
   `admin.thewomenscollective.club` → `/admin` and
   `crm.thewomenscollective.club` → `/admin` (expect failure/skip until VPS
   enabled, **or** gate behind a flag — prefer always asserting once AUDIT says
   live; until then add commented expectations + a note in AUDIT that smoke
   gains these lines when the integrator flips the switch).
3. Manifest: leave CRM-005/006/007, OPS-005/278/279 as `todo` or `built` with
   evidence "snippet ready, not enabled" — do **not** mark verified until
   integrator confirms live.
4. AUDIT-TASKS: short "admin-crm-cutover — repo ready" bullet with integrator
   steps (backup Caddyfile, paste snippets into TWC admin/crm blocks only,
   validate, reload, smoke, rollback path). Do not stop intake/crm containers
   in this phase.

## Done when

Typecheck/lint/tests/build green (or smoke script + md only); commit on
worktree only. Do not push. Do not SSH.
