# Legal pages: removed for now, required before launch

**Decision (user, 2026-11-11):** `/privacy`, `/terms` and `/code-of-conduct` are removed until they are written for
real. The routes are gone (all three 404), and nothing on the site links them: not the footer, the nav, the FAQ, the
contact and partnership consent sentences, `/fellowship`, `/contact`, `llms.txt`, `llms-full.txt`, `INDEXED` or the
sitemap.

**They are required before the public launch** (README "Launch checklist", step 4). The PIN does not come off
without them.

## Why they are required

- **Privacy policy (legally required).** The site collects personal data from applicants, members and anyone who
  writes in: names, email addresses, phone numbers, neighborhoods, businesses, portraits, application answers,
  contact and partnership messages, custom-form answers, Spotlight and review answers, newsfeed posts and photos,
  and the client IP (used in memory for rate limits). It shares data with, or exposes visitors to:
  - **Beehiiv** — newsletter subscriptions, only on an explicit opt-in (`subscribeIfConsented()`).
  - **Cloudflare** — all traffic passes through it (it sees IP addresses), and **Cloudflare Email Sending** sends
    every email (verification, password reset, thank-yous, welcome, admin alerts).
  - **Google sign-in** — when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set.
  - **OpenFreeMap** — the `/account` map loads tiles from `tiles.openfreemap.org`, which sees the member's IP.
  - The VPS host (the database and uploads live on it) and the Better Auth session cookie.
  The policy must name the operator (legal entity), a privacy contact, retention periods, members' rights and how
  to use them, and every processor above.
- **Terms of membership** — what members agree to: membership, the account, the directory, what they post (the
  newsfeed), events, leaving, liability and governing law (an attorney should write liability and venue).
- **Code of conduct** — what members expect of each other, the directory rule (not a mailing list), and how to
  report something and what happens next. `/contact` used to point its "Something happened" box at the code of
  conduct's "Reporting something" section; it now points at the contact form's "Reporting conduct" topic.

## What the removed drafts got wrong

Do not republish them as they were. They had:

- A yellow **TEMPLATE — NOT YET LEGAL ADVICE** box on every page, and open **[BRACKETS]** throughout: legal entity,
  privacy and reporting emails, retention periods, response period, reapplication period, county, review-group
  names, appeal deadline, `[IF GDPR APPLIES]`, `[JURISDICTION CHECK]`, `[ATTORNEY REQUIRED]`, `[DECISION NEEDED]`.
- **False claims about the system:** "There's no contact or partnership form on this site" (there are: `/contact`
  and `/partnerships`, stored in `inbox_messages`); "No newsletter platform is connected to this site" (Beehiiv is);
  third-party tools that left out Beehiiv, Google sign-in and OpenFreeMap; and nothing on the newsfeed, custom
  forms, Spotlight or review links.
- **Unsettled facts stated as settled:** "Membership is free. There are no dues, no tiers" (the fee is not decided;
  the FAQ leaves the question out for that reason), "We aim to answer within two weeks", and "in the Facebook group"
  (no such group is part of this site).

## Recovering the drafts

The drafts, the `LegalPage` layout (document tabs, "On this page" list, numbered sections) and their tests are in
commit `3f84d4aac9e6f864f24b8b99ccd5f0fa39201749` (`3f84d4a`, the parent of the removal commit):

```sh
git show 3f84d4a:src/features/legal/content.ts     # the three documents' text
git show 3f84d4a:src/features/legal/LegalPage.tsx  # the page layout
git show 3f84d4a:src/features/legal/heads.ts       # titles and descriptions (kept out of the entry chunk)
git show 3f84d4a:src/routes/privacy.tsx            # and terms.tsx, code-of-conduct.tsx
git show 3f84d4a:src/app/legal-route.test.tsx      # their tests
```

## Where to re-add the links

When the pages come back, restore each of these (all removed in the same commit):

- `src/app/seo.ts` `INDEXED` (that also puts them in `/sitemap.xml`), and `public/llms.txt` ("Policies" section).
- `AppFooter` in `src/app/layout/AppLayout.tsx`: the `Legal` nav in `.twc-footer__legal`, and the footer tests in
  `src/app/app-layout.test.tsx` (now they assert the opposite) and `src/app/status-pages.test.tsx`.
- Consent sentences in `src/features/contact/ContactForm.tsx` and `PartnershipForm.tsx`: the sentence "See the
  privacy policy." (with the link) was dropped from the end; the consent statement itself is unchanged. Consent
  wording is locked (AGENTS.md form-copy rule), so re-adding the sentence is a code change, not an admin edit.
- `/faq` (`src/routes/faq.tsx`): "What do you do with my information?" lost its closing "The full story is in our
  privacy policy." (restore the `link` and the `/privacy` target type); `public/llms-full.txt` mirrors it word for
  word (`src/app/llms-txt.test.ts`).
- `/contact` (`src/routes/contact.tsx`): the reporting box's "See Reporting something in our code of conduct."
  (`/code-of-conduct#report`), and its test in `src/app/contact-route.test.tsx`.
- `/fellowship` (`src/routes/fellowship.tsx`): the "Read the code of conduct" button under "Community principles",
  and its test in `src/app/fellowship-partnerships-route.test.tsx`.
- `/join`: consider linking the privacy policy and code of conduct from the "Privacy and membership" notice and the
  community guidelines (it never linked them).
- Not touched: custom forms imported from the CRM (`/f/<slug>`, `scripts/import-forms.ts`) whose consent label says
  "See the privacy policy." as plain text (form rows, editable in `/admin/forms`; check them when the policy returns), and the apex: its old legal pages stay served there (the three
  redirects were taken out of `migration/caddy-twc-redirects.caddy`, the rows in `migration/redirects.md` say "stays on
  apex", and the pages are in `KEEP_ON_APEX` in `scripts/migration-check.ts`). When the pages return, put all three back.
