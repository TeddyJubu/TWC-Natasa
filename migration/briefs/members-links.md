# Workstream: members-links

Read `migration/BRIEF.md` and `owner: "members-links"` manifest items. Prefer CRM inventory `CRM-*` and OPS review-link items.

## Build now (priority)

1. **Hashed review tokens** (FIX-IN-REBUILD plaintext `staging_links.txt`): store only a hash; single-use; TTL; neutral 404 for bad/used/expired.
   - Migration number: keep **`0003_member_links.sql`**. Legacy import is already **`0004_legacy_import.sql`** on main (must stay last — it replaces sign-up triggers).
2. **Member review / update link flow** in the app (not the old intake host): admin can mint a link; member completes corrections without self-approving.
3. **Spotlight** admin surface on `/admin` if inventory requires it for parity this slice; otherwise stub with manifest `todo` evidence pointing to follow-up.
4. Policy tests for token consume, expiry, and admin-only mint.

## Do not

- Port plaintext token storage.
- Let members approve themselves.
- Restyle `/account` beyond what's needed for the review form if it lives there.

## Done when

- Tests + typecheck/lint/build green; commit on branch only.
