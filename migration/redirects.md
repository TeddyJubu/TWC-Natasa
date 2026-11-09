# Redirect map — old site URLs → new app

Source of truth for the `vps-cutover` workstream (SITE-100, SITE-162, SITE-164). It mirrors `OLD_TO_NEW` in
`scripts/migration-check.ts`, which the gate reads, and the Caddy rules in `migration/caddy-twc-redirects.caddy`
(checked against this file by `src/app/cutover-redirects.test.ts`); change all three together.

**Rules**

- Every page is live at two URLs today because of `try_files {path} {path}.html`, so each row needs **both** the tidy path and the `.html` path. External links in emails and PDFs are more likely the `.html` form.
- One hop, `301`, to `https://new.thewomenscollective.club{new path}`. Nothing chains through another host or another redirect.
- Page redirects are `GET`/`HEAD` only. A `301` turns a `POST` into a `GET` and drops the body, so a form opened before the cutover (contact, newsletter, `/join`, `/review`) still posts to the old service and is stored (SITE-078/168, CRM-175).
- Query strings are dropped (`?form=…` on the thank-you pages carried nothing the new pages use).
- Apex `/` is **not** redirected: it stays the coming-soon page (BRIEF decision 1). `/index.html` → `/` (same page, one canonical form).
- The legacy files are archived on the VPS, never deleted (BRIEF decision 2).

## Pages

| Old path | Old `.html` path | New path | Notes |
|---|---|---|---|
| `/about` | `/about.html` | `/about` | |
| `/contact` | `/contact.html` | `/contact` | |
| `/directory` | `/directory.html` | `/members` | Vocabulary shift: Directory → Members (SITE-139). |
| `/events` | `/events.html` | `/gatherings` | Vocabulary shift: Events → Gatherings. |
| `/fellowship` | `/fellowship.html` | `/fellowship` | Built in this workstream (SITE-006). Western Queens only; no eligibility lists. |
| `/partnerships` | `/partnerships.html` | `/partnerships` | Built in this workstream (SITE-007). No "current partners" block. |
| `/editing` | `/editing.html` | `/account` | Editor guide; no equivalent screen yet (SITE-143). `/account` is behind sign-in. |
| `/privacy` | `/privacy.html` | `/privacy` | |
| `/terms` | `/terms.html` | `/terms` | |
| `/code-of-conduct` | `/code-of-conduct.html` | `/code-of-conduct` | |
| `/message-sent` | `/message-sent.html` | `/contact` | Generic thank-you; the new form confirms inline. |
| `/thanks-contact` | `/thanks-contact.html` | `/contact` | |
| `/thanks-newsletter` | `/thanks-newsletter.html` | `/contact` | The new app has no newsletter sign-up page; lands on the nearest working page. |
| `/subscribed` | `/subscribed.html` | `/contact` | Same as above. |
| `/thanks-partnership` | `/thanks-partnership.html` | `/partnerships` | The form there confirms inline. |
| `/404` | `/404.html` | *(retire)* | Served by the app's own not-found page. No redirect; a request for it returns the app's 404. |
| `/` | `/index.html` | `/` (coming-soon, unchanged) | Only the apex keeps the old file. |

## Application and sign-in URLs

| Old URL | New destination | Notes |
|---|---|---|
| `thewomenscollective.club/apply`, `/apply.html` | `https://new.thewomenscollective.club/join` | Today it is two hops (`join.*/join` → `new.*/join`, SITE-107). Point the apex rule straight at `new.*/join`. |
| `join.thewomenscollective.club/join` | `https://new.thewomenscollective.club/join` | Already one hop (Caddyfile `@joinform`). Keep. |
| `join.nbwc.site`, `nbwc.site/apply`, `forms.nbwc.site` | `https://new.thewomenscollective.club/join` | Chain them straight to the new app rather than via `join.thewomenscollective.club{uri}`. |
| `/login(.html)`, `/forgot-password(.html)`, `/set-password(.html)` (apex) | `https://new.thewomenscollective.club/auth` (`302`) | Decided by `vps-cutover` (SITE-106): the app's sign-in has the reset link. `302` as before, so it can still change. |
| `/members`, `/members/*` (apex) | `https://new.thewomenscollective.club/members` (`302`) | Old member pages are gone; old slugs don't match the app's `/members/:slug`, so the list page. |
| `/apply-thank-you(.html)` (apex) | `/` (`302`, unchanged) | Sending someone who already applied to a blank form would read as "it didn't work". |
| `members.thewomenscollective.club/join` | `https://new.thewomenscollective.club/join` | It still served the old form (BRIEF 12, OPS-007). `/join/thanks` stays on intake for stale posts. |

## Host redirects (members / admin / join / crm)

| Old host + path | New destination | Notes |
|---|---|---|
| `members.thewomenscollective.club/review?t=…` | `https://new.thewomenscollective.club/review?t=…` | **Keep the query string.** Built by members-links (`/review` + hashed tokens). |
| `members.nbwc.site/review?t=…` | same | Same as above. |
| `admin.thewomenscollective.club/*` | `https://new.thewomenscollective.club/admin` | After parity; session is the new app's. |
| `crm.thewomenscollective.club/*` | `https://new.thewomenscollective.club/admin` | After CRM parity. |
| `join.thewomenscollective.club/join` | `https://new.thewomenscollective.club/join` | Already in place. |

## Not redirected yet

- Static assets under `/assets/*`, `/embed.js`, favicons and `robots.txt` stay with the archived site until `vps-cutover` removes them.
- Apex `/f/*` custom forms (OPS-518): the new app now serves `/f/<slug>`, `/f/<slug>/thanks` and old names (301 to the current slug), so `/f/*` can 301 to `https://new.thewomenscollective.club{uri}`, **keeping the path and the query** (resume links carry `#resume=…` in the fragment, which the browser keeps across a 301). Wait until the live forms are imported into `custom_forms` (custom-forms follow-up). Until then an unknown slug is a 404 on the new app. Still served by the old site: `/f/<slug>/thanks-<n>`, `thanks-go`, `thanks-waitlist`, `full`, `event.ics`, `/f/media/*` and `/forms`, which have no new route yet.
