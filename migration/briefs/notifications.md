# Workstream: notifications

Read `migration/BRIEF.md`, `migration/inventory/ops-part-d.md` (confirmations, resume, Beehiiv), CRM notify items, and `owner: "notifications"` in the manifest.

## Build now (priority)

1. **Beehiiv consent (FIX-IN-REBUILD):** one `subscribeIfConsented()` path. Applications require `newsletter == yes` **and** `email_subscription_consent == yes`. Site/newsletter form and `newsletter_subscribers.consent` null handling: document and implement safely (never re-subscribe from a replayed row — OPS-521).
2. **Admin alert when a member review arrives** (left open by members-links).
3. **Approval welcome email** already exists — do not regress. Wire review-received and optional partnership/contact admin alerts through `sendEmail()`.
4. Confirmation / finish-later emails for custom forms: stub or defer to custom-forms if `/f/*` is not ready; mark manifest accordingly.

Env: use variable **names** only (`CF_EMAIL_*`, `BEEHIIV_*`). Never print secrets.

## Done when

Tests + typecheck/lint/build; commit on branch only.
