# Workstream: public-pages

Read `migration/BRIEF.md` and your owned items in `migration/manifest.json` (`owner: "public-pages"`).

## Build now (priority)

1. **`/fellowship`** scrapbook page (`src/routes/fellowship.tsx`) — SITE-006, SITE-036–041, SITE-148.
   - Western Queens geography only; drop Brooklyn place names (SITE-159 improvisation).
   - Drop placeholder eligibility lists (SITE-038); link to `/join` and `/faq`.
   - Match scrapbook kit (`AppPage`/`AppNav`/`AppFooter`, `twc-*`). Sentence-case Gilda headlines.
   - Add to `INDEXED` in `src/app/seo.ts` and sitemap coverage tests.
2. **`/partnerships`** scrapbook page (`src/routes/partnerships.tsx`) — SITE-007, SITE-042–044, SITE-149, SITE-173.
   - No "current partners" block until facts are re-supplied (SITE-043/157).
   - Partnership inquiry form: posts to the shared inbox API (admin-inbox owns storage). If that API is not on main yet, build the page + form UI wired to a stub mutation matching `{ kind:"partnership", name, email, business, collaboration_type, message, consent, honeypot }` and leave a clear TODO comment; prefer coordinating with the admin-inbox branch shape in `migration/briefs/admin-inbox.md`.
3. Redirect map doc under `migration/redirects.md`: every old `/x` and `/x.html` → new path (SITE-100/162). Collapse `/apply` to one hop.

## Do not

- Restyle `/account`.
- Invent prices, emails, partner names, or eligibility rules.
- Touch VPS Caddy (vps-cutover owns that).

## Done when

- Routes exist; typecheck/lint/tests/build pass.
- Manifest items you finished flip to `status: "built"` with `evidence` (test name).
- Commit on your branch only; message ends with Co-Authored-By trailer. Do not push/merge.
