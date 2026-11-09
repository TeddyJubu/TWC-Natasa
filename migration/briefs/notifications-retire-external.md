# Workstream: notifications — retire external mirrors

Read `migration/BRIEF.md`, `AGENTS.md`, `AUDIT-TASKS.md`, remaining
`owner: "notifications"` todos for Hermes, Notion, webhooks, pitch.

## Decision (record in AUDIT)

For this migration cutover, **Hermes auto-approve / WhatsApp**, **Notion intake
mirror**, and **outbound webhooks** are **not** required for `twc_admin_cutover`.
Admin alerts + submitter confirmations + Beehiiv consent gate are enough for
day-to-day. Retire those inventory items with `built` + `target: retired` and
honest evidence ("out of scope for rebuild cutover; may return later").

## Do now

1. Retire Hermes-related CRM/OPS items still `todo` (e.g. OPS-368, CRM Hermes
   ids, auto-approve OPS if present) — evidence: no Hermes in the Node app;
   approve/decline are human `/admin` actions.
2. Retire Notion mirror items (CRM-155, OPS Notion ids) — evidence: no Notion
   client in rebuild.
3. Retire outbound webhook / connections-secret items that are CRM
   `connections.json` era — evidence: no webhook dispatcher; forms store in
   SQLite.
4. Leave `todo`: per-form `notify_settings` UI, custom-form confirmations,
   finish-later, pitch heuristic, bulk Beehiiv re-sync — unless clearly dead.

No product code required unless a stub exists to remove. Do not push.
