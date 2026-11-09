# Workstream: vps-cutover remainders (inventory)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, remaining
`owner: "vps-cutover"` todos (~123), `migration/redirects.md`,
`migration/caddy-twc-redirects.caddy`, live cutover notes in AUDIT.

## Already live / on main

Apex + members + nbwc + admin/crm cutovers on; directory img 404; join/review/
spotlight scrapbook; smoke script green. Forms cutover held (0 live forms).
CRM-006 / OPS-279 stay `built` (crm-test). OPS-518 `/f/*` stays todo until a
live form exists. OPS-156 stays with intake stop.

## Do now

1. Flip already-true cutover/redirect inventory to `verified` with live or
   snippet evidence.
2. Retire Classic host/path leftovers that will never ship.
3. Do **not** stop intake/crm containers or change live Caddy — inventory only.
   Note stop readiness in AUDIT if clear.

Commit on worktree only; do not push.
