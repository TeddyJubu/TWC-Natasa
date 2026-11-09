# Workstream: join / review close switch (product)

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`. Covers **OPS-081**,
**OPS-140** (admin-inbox-owned twin).

## Build

Admin-controlled open/closed for scrapbook `/join` and `/review` (Spotlight stays
always-on — no old switch). Closed = public page shows closed words on 200 (like
custom forms); open links still resolve. Prefer a small `forms_state`-style row or
reuse an existing settings table — no Classic JSON. `requireAdmin` to toggle from
`/admin`. Migration + tests. Record improvisations in AUDIT.

Commit on worktree only; do not push. Report ids flipped to `built`.
