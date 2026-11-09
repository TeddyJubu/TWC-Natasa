# Workstream: admin-inbox

Read `migration/BRIEF.md` and items with `owner: "admin-inbox"` in `migration/manifest.json`.

## Build now (priority)

1. **Store contact (+ partnership) messages in SQLite** (BRIEF decision 9, SITE-145/169/171).
   - Migration `db/migrations/0002_inbox.sql` (use 0002 only if free; otherwise next free number — check `db/migrations/`).
   - Table e.g. `inbox_messages`: id, kind (`contact`|`partnership`), name, email, topic (nullable), business (nullable), collaboration_type (nullable), message, created_at, status (`new`|`archived`), ip_hash optional.
   - `/api/contact` (and `/api/partnerships` or same route with kind) writes a row **and** emails admins (existing behaviour). Honeypot: success without store. Consent required. Keep IP rate limit. Add honeypot field client-side.
   - Expand contact topics: add spotlight, accessibility, conduct (SITE-055) without inventing copy beyond short labels.
2. **Admin inbox card** on `/admin` (app shell vocabulary — `Card`, `Row`, `Chip`): list new messages, archive, open detail. Guard with `requireAdmin`. Policy tests.
3. List applications/members already exist — do not regress approve/decline.

## Partnership form contract (for public-pages)

Accept JSON:
```json
{
  "kind": "partnership",
  "name": "...",
  "email": "...",
  "business": "...",
  "collaboration_type": "host|teach|supply|support|other",
  "message": "...",
  "consent": true,
  "honeypot": ""
}
```

Add body route to `API_ROUTES` in `src/start.ts` with a test.

## Done when

- Messages persist and show in `/admin`.
- Tests cover guards, honeypot, rate limit, storage.
- Manifest items flipped to `built` with evidence.
- Commit only; no push/merge.
