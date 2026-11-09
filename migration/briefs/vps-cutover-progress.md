# Workstream: vps-cutover progress (manifest honesty)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md` (vps-cutover bullets),
`migration/caddy-twc-redirects.caddy`, `migration/redirects.md`,
`scripts/smoke-cutover.ts`, and remaining `owner: "vps-cutover"` todos.

## Already true on the VPS / main (do not re-apply)

- Apex + members + nbwc cutover snippets live; smoke-cutover green
- Legacy import + spotlight import done; forms import 0/0
- `/review` and `/spotlight` 301 from members.* (GET/HEAD)
- `/join` 301 from join.*/members.*
- `/f/*` **not** redirected (no live custom forms)
- `twc_admin_cutover` / `twc_crm_cutover` **not** enabled

## Do now

1. Flip matching OPS/CRM/SITE inventory items that describe the **already-live**
   redirects, archive, smoke, or imports from `todo`/`built` → `built` or
   `verified` with evidence citing AUDIT timestamps / smoke-cutover / Caddy
   backups. Prefer `verified` only when acceptance is fully met.
2. Retire items that are obsolete post-rebuild (e.g. old CRM process mounts that
   vps-cutover owns) only with clear evidence.
3. Explicitly leave `todo` with an AUDIT note:
   - enabling `twc_admin_cutover` / `twc_crm_cutover`
   - stopping intake/crm/forms containers
   - `/f/*` cutover (waits on a live form)
   - OPS-156 old internal link API (if still relevant)
4. Do **not** SSH or change the VPS in this workstream — manifest + docs only
   unless a smoke-test expectation in-repo is wrong.

## Done when

Commit on worktree only; report how many flipped and what still blocks admin/crm
cutover. Do not push. Do not enable cutover flags.
