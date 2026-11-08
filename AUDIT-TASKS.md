# Audit Task List — 2026-11-07

Merged from five independent, context-free audits: **S** security · **L** logic/flows · **A** architecture · **F** frontend (a11y/perf) · **B** build/tooling.
Tags show which auditors found each issue independently; more tags means more confidence.
Baseline: `tsc` ✅ · `vite build` ✅ (warns on a 585 kB chunk) · `eslint` ❌ 7 errors · `bun audit` 69 vulns (1 runtime).

---

## P0 — Broken core flows & data exposure

- [x] **1. The join form saves nothing.** `MembershipApplication.tsx:50` only sets `submitted=true`. Add an `applications` table (owner insert, admin read), wire up the submit, give the ~20 inputs that lack one a `name`, enforce required `ChoiceGroup`s, and show success only after the insert works. `S L A F`
- [x] **2. Lock down the `avatars` storage bucket.** The `"Avatar read"` policy (migration :136) lets anonymous visitors list and download every portrait, including pending and declined members. Limit reads to owner and admin, serve directory portraits only for approved + visible members, add an owner delete policy, **create the bucket in a migration** (it's missing now), and set mime/size limits. `S L A` **Done (0001, 0002):** private `avatars` bucket created in 0001 (JPEG/PNG/WebP, 5 MB); reads limited to owner, admins and approved + listed owners (anon only for opted-in public profiles, 0002); `Avatar own delete`. `rls.sql` checks reads per role, owner-only delete and the bucket settings.
- [x] **3. Enforce approval in the database, not just the UI.** Events, RSVPs and bookings policies accept any signed-in user, so pending and declined accounts can read venues and RSVP through the API. Add `and public.is_approved(auth.uid())`. `S` **Done (0001):** events, RSVP and booking policies require `is_member()` (self-only, replaces `is_approved(auth.uid())`); admins via `is_admin()`. `rls.sql`: a pending member reads no events and can't RSVP or book.
- [x] **4. Restrict the functions callable by anonymous users.** `revoke execute` on `has_role` and `is_approved` from `anon`/`public` (right now anyone can find out who is an admin). Stop returning `id` from `public_directory()`. `S` **Done with a deviation (0001, 0002):** `has_role`/`is_approved` revoked from everyone (both checked in `rls.sql`). `public_directory()` is members-only now (decision 1), so it keeps `id` (the card key) but returns it to approved members and admins only; the anonymous path, `public_profiles()`, returns no `id` (checked).
- [x] **5. Make deleting a login also delete the member's data.** Add `references auth.users(id) on delete cascade` to `profiles.id`, `user_roles.user_id`, `event_rsvps.user_id` and `headshot_bookings.user_id`. Without it, a deleted user stays listed in the public directory. `S L A` **Done (0001):** all four `on delete cascade` FKs (`not valid`, so old rows aren't rechecked, but the cascade applies). `rls.sql`: deleting a login removes her profile, roles, RSVPs and booking.
- [x] **6. Protect booking status.** Members can set their own `headshot_bookings.status` to `confirmed`. Guard it with a trigger, reset it to `'requested'` when a member changes the booking, and show the status in the UI. `S L` **Done (0001, Phase 7):** status check constraint plus `protect_booking_status()`, which resets any member insert or update to `requested`; admins confirm in `/admin`. `rls.sql`: no self-confirm, and changing a confirmed booking resets it. `/account` shows requested, confirmed or declined (it said "Request received… We’ll confirm by email" whatever the status, and no email is sent).
- [x] **7. Add database constraints.** Bio and looking-for length, `website ~ '^https?://'`, neighborhood check, and `avatar_path` must start with `id || '/'` (a member can currently point their card at someone else's photo). `S` **Done (0001):** length, `website ~* '^https?://'`, neighborhood FK to `neighborhoods(name)` and own-folder `avatar_path` constraints (`not valid`: they bind every new write). `rls.sql` checks each.

## P1 — App correctness

- [x] **8. Account page failure states.** A missing profile row or query error gives an endless spinner with no way to sign out (`account.tsx:63,139`). Handle `declined` status, which currently shows as "In review". Give the spinner `role="status"`. `L A F`
- [x] **9. Stop swallowing errors.** Check the result of `toggleRsvp`, `bookHeadshot` and the profile update after an avatar upload; add busy states. Validate file size and type on the client and reset the file input's value. `L A F`
- [x] **10. Directory correctness.** Show the stored `catalogue_number`, not `index+1` (add it to `MemberProfile`). Show demo members only when there are no real ones, with the banner and count conditional. Build filter chips from the canonical list, not the demo data. Use initials instead of `hero.jpg` with misleading alt text. `L A F` **Done (Phases 1, 2, 7):** stored `catalogue_number`; demo members only in `/components` (decision 3 replaces "only when there are no real ones"); chips from `neighborhoods` data; portrait-less members show their initials on a neutral mat on every card surface, never `hero.jpg` (Phase 7).
- [x] **11. One neighborhood source of truth.** The list is duplicated in about 8 places, and Woodside/East Elmhurst are inconsistent. Create one module with `{name, slug, color classes, logo}` and a `Neighborhood` type, and derive every map from it. Remove the `'Long Island City'` database default. `L A` **Done (Phases 1, 7):** `src/features/neighborhoods` (`NEIGHBORHOOD_SEED`, `useNeighborhoods`, `toneFor`, `pickerNames`) is the only list behind app UI (pickers, filters, cards); colours and logos come from data. What's left hard-coded is copy, not data: the homepage's seven constellation cards (bundled photos), its Ribbon (adds Woodside) and FAQ answer (adds Woodside and East Elmhurst, "and surrounding Queens neighborhoods"), and `/join`'s free-text "Where are you based?" options (applicants may live outside the list). Adding Woodside as a neighborhood is content: an admin can do it in `/admin` without code. Migration 0004 drops the `'Long Island City'` default: `profiles.neighborhood` is nullable (FK kept), and the UI offers "Choose your neighborhood".
- [x] **12. Dates and times.** The headshot `min` date uses UTC (`account.tsx:257`). Format events in `America/New_York`. Add an empty state when there are no events. Move the seed events out of the schema migration. `L A` **Done (Phase 2), one part won't fix:** local headshot `min` (`localDateISO`), New York event times (`eventWhen`), empty state. Moving the seed events out of `0000_migration.sql` is **won't fix**: 0000 is already applied live, and editing an applied migration would make the history disagree with the database.
- [x] **13. Fields saved but never shown.** Bio, looking-for and website don't appear on catalogue cards, and `website` isn't returned by `public_directory`. The "Live preview" ignores unsaved edits: make it controlled, or rename it. `L` **Done (0001, Phases 2, 7):** `public_directory()` returns `website`; the account preview follows unsaved edits; catalogue cards open a member profile dialog with bio, looking-for and website (Phase 7, new UI for owner review below).
- [x] **14. Auth flows.** Clear the error and notice on every mode change. Use generic error messages so the form doesn't reveal which emails have accounts. Detect sign-up with an existing email. `/reset-password` should require a `PASSWORD_RECOVERY` session and handle expired links. `S L`
- [x] **15. Introductions query.** It sorts by neighborhood only after `.limit(12)` on unordered rows. Filter or order in the query itself. `L`

## P2 — Architecture

- [x] **16. Keep showcase code off the live site.** The `Shell` toolbar (Colors, Typography, Dark toggle) shows on `/`, `/members` and `/join`. Add an app layout, and noindex or hide `/colors`, `/typography` and `/components` in production. Update `AGENTS.md`. `A F`
- [x] **17. Navbar and Footer.** They render plain `<a href>`, so every internal link reloads the page; accept a router link component. There's no mobile menu (`layout.tsx:136` is `hidden md:flex`), so phone users have no navigation. `L A F`
- [x] **18. Data layer.** React Query is installed but never used, and all data loading is hand-written `useEffect` + `useState`. Either adopt `queryOptions`/`useMutation` in a `src/features/members/` module or remove the package. Split the 296-line `account.tsx` into sections. `A` **Done (Phases 1, 7):** all reads and writes go through `queryOptions`/`useMutation` in `src/features/*`; `account.tsx` is split into section components in `src/features/account/`, each owning its queries and mutations.
- [x] **19. Design-system boundary.**
  - Fonts load from `src/assets/fonts`, which is outside the design system and breaks attach. Move them into `design-system/assets`.
  - Move the demo data and founder photo out of `design-system/`, and move the `MemberProfile` type into `member-card.tsx`.
  - Import only from the barrel, and enforce that with ESLint `no-restricted-imports`.

  `A` **Done (Phase 1):** fonts in `src/design-system/assets/fonts`; demo members and portraits in `src/showcase/`; `MemberProfile` exported from `member-card.tsx`; ESLint `no-restricted-imports` both ways (`eslint.config.js`).
- [x] **20. Accessible form components.** `FormField` should inject `aria-describedby`/`aria-invalid` itself instead of callers hard-coding magic ids. Give `ChoiceGroup`/`RadioGroup` controlled `value` and real `required` validation. `A F L`
- [x] **21. Migration workflow.** `drizzle/schema.ts` is empty, so `drizzle-kit push` could drop live tables. Choose SQL-only (remove `drizzle-orm`, `postgres` and `schema.ts`) or properly wire up Drizzle, and document the choice. `A B` **Done (Phase 6):** kept SQL-only with Drizzle as the runner (Lovable needs `drizzle-kit migrate` + a driver, so `drizzle-kit`, `drizzle-orm`, `postgres` and `drizzle.config.ts` stay). README "Migration workflow": never `drizzle-kit generate`/`push`; hand-written SQL + journal entry + `rls.sql` checks; `bun run test:db`.

## P3 — Frontend performance & accessibility

- [x] **22. Fixed positioning bug.** The `.motion-route-in` animation keeps `translateY(0)` applied, so `position:fixed` children (the toolbar, preview frames, any future modal) are positioned against the page instead of the viewport. End the animation at `transform:none`, or animate opacity only. `F`
- [x] **23. ImageTrail weight.** The server renders 24 `<img>` on every page, pulling about 2 MB of 816px PNGs even on touch devices. Render them client-side only after a pointer check, use ~96px WebP, and reconsider mounting it in the "providers-only" root. `F B`
- [x] **24. CircularGallery.** It listens on `window` (scrolling anywhere spins it), double-counts `mousewheel`, runs requestAnimationFrame forever, never releases the WebGL context, and rebuilds on every render because `items` is a new array. `F A`
- [x] **25. Fonts.** About 700 KB of TTF. Convert to subset `woff2` and preload the display face. `F B`
- [x] **26. Contrast.**

  | Element | Contrast | Needs |
  |---|---|---|
  | Primary sky button | 3.7:1 | 4.5:1 |
  | Neighborhood card titles | 1.8–2.8:1 | 3:1 |
  | `ink-faint` mission statement, tabs and placeholders | about 1.9:1 | 3:1 for the statement |

  Catalogue card number and label fail too. Force `tone-night` on catalogue cards. `F`
- [x] **27. Motion and screen readers.** The ribbon text is read 12 times and never pauses. CurvedLoop rings have no pause control. The reduced-motion gallery announces each image twice. `F` (CurvedLoop finished in Phase 7: the rings stop on their own after 5 s.)
- [x] **28. Semantics.**
  - No `<main>` and no skip link.
  - Heading jumps (h1 → h3 on `/join`).
  - `FormSection` announces its title twice.
  - Tabs `aria-controls` point at ids that don't exist, and arrow keys don't work. The `/auth` tablist has no panels.
  - Missing focus rings on Accordion/Tabs.
  - Focus isn't reset on route change.

  `F`
- [x] **29. Images.** Add `srcset` and resized variants (the founder photo is 2000px for a ~600px slot). Use the white logo directly instead of inverting seven colored ones. Add `fetchpriority` to the hero. `F`
- [x] **30. Bundle.** `__root.tsx` imports Supabase, so every marketing page ships the full SDK (main chunk 585 kB). Load it lazily. `B F` **Done (Phase 1):** `getSupabase()` in `src/app/supabase.ts` imports the client on first use; `src/app/no-static-supabase.test.ts` guards the public entry routes. Main chunk 585 kB before Phase 1; 253.36 kB (+ 59.54 kB `matchContext`) after Phase 6.
- [x] **31. Per-card effects.** ProximityText mixes layout reads and writes and sets `will-change` on every letter. CurvedLoop runs requestAnimationFrame off-screen and measures before fonts load. `F`
- [x] **32. SEO.** `og:image` missing, `twitter:site=@Lovable`, no canonical, robots.txt or sitemap, no custom 404/error page. `F A` (Sitemap split out: see Phase 4 "Still open".)

## P4 — Tooling & hygiene

- [x] **33. Lint.** Fix the 7 lint errors (`circular-gallery.tsx:29`, empty interfaces in `form`, `motion` and `typography`, `previewAuthStorage.ts:38`). Add `typecheck` and `check` scripts. Turn `no-unused-vars` on as a warning. `B A` **Done (Phase 6):** 0 errors / 0 warnings. Generated and plugin-installed files are ignored, not edited; `no-unused-vars` warns (`^_` ignored).
- [x] **34. Dependencies.**
  - `bun update` the TanStack, Vite and Cloudflare packages: **seroval** has a vulnerability that ships at runtime.
  - Move the TanStack runtime packages to `dependencies` and `tailwindcss` to dev (otherwise `audit --prod` falsely reports clean).
  - Add `wrangler` as a dev dependency plus a `deploy` script.
  - Pin versions consistently.
  - Bind the dev server to `localhost` instead of `::`.

  `B A` **Done (Phase 6):** TanStack runtime in `dependencies`, `tailwindcss` in dev, every version exact, `wrangler` 4.156.1 + `deploy`, dev server on `localhost`. TanStack/Vite/Cloudflare/Tailwind updated within majors; `seroval` 1.6.8 → 1.7.7. `bun audit` 69 (35 high, 26 moderate, 8 low) → 29 (21 high, 7 moderate, 1 low); what remains is build/dev tooling (Babel/browserslist, esbuild via drizzle-kit and lovable-tagger, eslint, the router generator), not shipped to the browser or Worker runtime.
- [x] **35. `.env`.** It's tracked by git, and the build copies it into `dist/server/.dev.vars`. Never put the service-role key in it. Add it to `.gitignore` with a `.env.example` (check how Lovable syncs it first). `B` **Done (Phase 6):** `.env` stays tracked on purpose (Lovable needs its `VITE_` values) and holds publishable values only. `src/app/secrets.test.ts` fails if any tracked or new file holds an `sb_secret_` key, a `service_role` JWT or a value for `SUPABASE_SERVICE_ROLE_KEY`/`LOVABLE_CRON_SECRET`. `.env.example` added; README says secrets go in `.dev.vars` or Wrangler secrets.
- [x] **36. Path aliases.** Replace `vite-tsconfig-paths` with Vite's native tsconfig paths and drop the duplicate `@` alias. `B` **Done (Phase 6):** Vite 8 `resolve.tsconfigPaths` in Vite and Vitest; `vite-tsconfig-paths` and the manual `@` alias are gone; tsconfig has `node` types and no dead `eslint.config.js` include.
- [x] **37. Docs and naming.** Rewrite `README.md`. Make `system.md` (now `DESIGN.md`) match reality (it bans inline styles and raw colors, which components use). Rename the worker and package from template names and bump `compatibility_date`. Remove the unused original logo. Use `state="loading"` in the showcase. `A B` **Done (Phase 6):** package renamed `twc-natasa`; unused original logo deleted; `/components` uses `state="loading"`; `DESIGN.md` (then `.lovable/system.md`) now states the real `--hood`/runtime inline-style and `white`/`black` exceptions. The Worker name and `compatibility_date` are owner decisions (below).
- [x] **38. Security headers.** Add CSP `frame-ancestors 'none'`, `X-Content-Type-Options` and `Referrer-Policy` through the Worker. `S` **Done (Phase 6):** via `src/start.ts` request middleware (`src/app/security-headers.ts`): CSP `frame-ancestors 'self'` plus the Lovable editor origins (not `'none'`, which would break the editor), `nosniff`, `strict-origin-when-cross-origin`, a minimal `Permissions-Policy`. Start's CSRF middleware is restated because a start instance replaces the default. Checked on the built Worker: page 200 and unknown path 404 carry the headers; a cross-site server-function POST is 403.

---

## Decisions (2026-11-07)

1. **Directory is members-only.** Approved members (and admins) see the directory and portraits; anonymous visitors don't.
2. **Applications from both paths.** Anonymous applicants and signed-in members can both apply. An anonymous application links to an account once someone signs up and *confirms* the same email.
3. **Demo members leave the live pages.** Real members are in `profiles`. The fictional set stays only in the `/components` showcase.
4. **Build `/admin`.** It reviews applications and profiles, approves or declines, and manages neighborhoods. The first admin is added by hand: `insert into user_roles (user_id, role) values ('<uuid>', 'admin')`.
5. **Neighborhoods become content.** A `neighborhoods` table holds name, slug, color and an uploaded logo, and admins can add more. Neighborhood colors in app UI come from data via a CSS variable rather than fixed Tailwind classes.
6. **Profile edits go live instantly.** Task 39 (re-review after edits) is not needed.
7. **Public profiles are opt-in (2026-11-08, Phase 2).** A member who switches on "Show my profile on the public website" can be seen on public pages: the homepage gallery and the public view of `/members`. That applies only while she is approved *and* listed in the directory. Everyone else stays members-only. The homepage gallery shows only these members.

## Owner decisions

Left for the owner because they change the deployment, the live database or the product:

1. **Worker `name` and `compatibility_date`** in `wrangler.jsonc` (`tanstack-start-app`, `2025-09-24`). Renaming creates a new Worker (new URL; routes, secrets and bindings must move with it); bumping the date changes runtime behaviour. Change both together, with Lovable's deploy in mind.
2. **Full Content-Security-Policy.** Today it's `frame-ancestors` only. A `script-src`/`style-src` policy needs per-request nonces for SSR hydration (and allowances for Supabase, Lovable auth and the fonts); roll it out as `Content-Security-Policy-Report-Only` first.
3. **Apply migrations 0001–0004 to the live database**, in order, then regenerate the Supabase types and deploy (README "Go-live order").
4. **CAPTCHA or rate limiting** for anonymous `/join` applications.
5. **Email notifications** when an application is approved or declined.
6. **Sitemap domain.** Set `VITE_SITE_URL` in production so canonical/`og:url` are emitted and a `sitemap.xml` can be generated.
7. **Business logos after approval.** `/join` tells applicants "If you are approved, we will ask for your business logo then", but nothing collects or shows one yet. Decide where logos appear (catalogue card, profile dialog, spotlight) and who uploads them (the member on `/account`, or an admin); then it's a column, a bucket path and a field.
8. **Headers on static assets** (optional). Files served straight from the Workers assets binding skip the Worker, so they lack `nosniff` and the other headers. A `public/_headers` file would add them; check it against Lovable's deploy first.
9. **Approve or reject the Phase 7 UI additions** (Progress → Phase 7): the member profile dialog, the initials mat on portrait-less cards, the headshot status copy, and the CurvedLoop rings resting after 5 s.

Also before go-live, by hand in a browser: tap a hash link (`#constellation`) in the mobile menu and check the page still scrolls to it once the menu's scroll lock is released.

## Progress

- [x] `drizzle/migrations/0001_members_only_admin.sql`: tasks 2–7 plus the neighborhoods, applications and admin schema. Its 27 original checks, plus the T2–T7 checks added in Phase 7, pass in `drizzle/test/run.sh`. **Not yet applied to the live database.**
- [x] Phase 1 (Foundations, 2026-11-08): `features/` + `app/` folders, lazy Supabase, `useNeighborhoods`, `MemberCard` `tone` prop, ESLint boundaries, Vitest. `/members` and `/account` read and write through TanStack Query (`features/members`, `features/events`) with one shared mapper and visible errors. Neighborhood options and colors come from data. Covers T19 and T30, and most of T11 and T18 (the database default and the `account.tsx` split were left for Phase 7).
- [x] Phase 2 (Member flows, 2026-11-08): migration `0002_public_profiles.sql` (opt-in `public_profile`, `public_profiles()`, anon portrait reads; 44 RLS checks). `viewerQuery` and `publicProfilesQuery`; `/members` serves approved members the full directory and everyone else public cards with a sign-in or "welcomed in" prompt; the home gallery shows public profiles only; no demo members outside `/components`. Account: public-profile switch, `declined` status, real intros (neighborhood-first in the query), a preview of unsaved edits, avatar type/size checks, New York event times, local headshot date, empty states. Auth: no account disclosure, mode resets, recovery-only password reset. Route tests via Testing Library + jsdom. Covers T8, T9, T14, T15 and most of T10, T12 and T13. **0001 and 0002 must be applied to the live database together with this code.**
  - Left from those tasks: initials instead of `hero.jpg` on portrait-less cards (T10) and bio/looking-for/website on catalogue cards (T13), both moved to Phase 7; moving the seed events (T12) is won't fix.
- [x] Phase 3 (Applications + admin, 2026-11-08): migration `0003_admin_review.sql` (`link_applications()` now gives a still-pending profile the outcome of an already reviewed application, approved or declined, and fires after profile creation so OAuth sign-ups work; one-time backfill; `applications.reviewed_by` set from `auth.uid()` and unforgeable; inserts can't arrive pre-reviewed; `lower(email)` index; 72 RLS checks). `/join` submits for real through `features/applications` (typed answers, `parseApplication` mirroring the DB checks, success only after the insert, Retry on error, prefill for signed-in applicants; logo upload moved to after approval). `FormField` wires id/`aria-describedby`/`aria-invalid` itself; `ChoiceGroup`/`RadioGroup` are controlled and a required group blocks submit with a visible error. `/admin` (guarded by `is_admin()`, own chunk) with Applications, Members, Neighborhoods (logo upload) and Bookings tabs in `features/admin`; admins see the full `/members` directory and an Admin link in the account nav. Covers T1 and T20. **0001–0003 must be applied to the live database together with this code** (see README "Database & go-live").
  - Left to the owner: CAPTCHA/rate limiting for anonymous applications, email notifications on review, logo collection after approval (Owner decisions 4, 5, 7).
- [x] Phase 4 (Site shell, 2026-11-08):
  - **T22:** every animation that stays applied (fill-mode `both`), and the revealed `.motion-observed` state, now rests at `transform: none` / `filter: none`, so `position: fixed` descendants pin to the viewport again. Guarded by `theme.test.ts`.
  - **T16:** live pages use `src/app/layout/AppLayout.tsx` (`AppPage`, `AppNav`, `AppFooter`). The `Shell` toolbar appears only on `/colors`, `/typography` and `/components`, which are `noindex` and disallowed in `public/robots.txt` along with `/__mockup` and `/__component`. Its dark theme no longer leaks onto live pages, and the root stays providers-only.
  - **T17:** `Navbar` and `Footer` take a `linkComponent`, so internal links navigate client-side through the TanStack adapter in `AppNav`/`AppFooter`, while hash, mailto and external links stay plain. There is a mobile menu below `md`:
    - a disclosure button whose panel is always mounted (`hidden` when closed);
    - focus moves into the panel on open, and Escape closes it and returns focus;
    - it closes on any link click in the bar, on back/forward, on a hash change and when widening past `md`;
    - body scroll is locked while it's open, and reduced motion is respected;
    - hide-on-scroll never hides the bar while the menu is open.
  - **T32:**
    - Styled `NotFound` and `ErrorPage` (with a link home and Try again) are the router defaults.
    - The root has a real title and description, and `twitter:site=@Lovable` is gone.
    - The optional `VITE_SITE_URL` must be a bare http(s) origin. When it's set, every page gets an absolute `og:image`, and the indexable public pages (`/`, `/members`, `/join`, `/auth`) get a canonical and `og:url`. 404 and error pages never get a canonical or `og:url`, though they still get the `og:image`. When it's unset, none of these are emitted.
  - Follow-ups:
    - `sitemap.xml`, which needs `VITE_SITE_URL` at build time: left to the owner (Owner decision 6).
    - Query-string hrefs in the nav adapter: not needed while no link uses one.
    - A manual check that hash links from the mobile menu still scroll once the scroll lock is released: in the go-live check under Owner decisions.
    - ~~Click-outside to close the menu.~~ Done in Phase 5 (close on outside tap).
    - ~~Confirming that SSR answers unknown paths with HTTP 404.~~ Confirmed in Phase 6 on the built Worker (`wrangler dev`).
    - `robots.txt` blocks the showcase pages, so crawlers never see their `noindex`. If they ever show up in search, drop the `Disallow` lines and rely on `noindex`.
- [x] Phase 5 (Polish, 2026-11-08): T23–T29 and T31.
  - **T26 contrast**: ratios are asserted in `src/app/contrast.test.tsx` against the token values parsed from `theme.css` (`src/test/contrast.ts`). Visual changes for the owner's review are listed below.
  - **T27/T28 screen readers, motion and semantics**:
    - The Ribbon is read once, pauses on hover and has a "Pause ribbon" toggle that appears on focus.
    - CurvedLoop rings are `aria-hidden`, and the reduced-motion gallery reads each image once.
    - Tabs: every panel exists (hidden when inactive; only the active one mounts its content, so `/admin` doesn't fetch all four tabs), roving tabindex with Arrow/Home/End, and focus rings on Tabs and Accordion.
    - The `/auth` switch is an `aria-pressed` toggle group, and `FormSection` is named once through `aria-labelledby`.
    - Heading order is fixed (`/join` uses h2 sections; the mission section has an h2) and guarded by `expectNoSkippedHeadings()`.
    - There's a skip link and one `<main id="main">` on every live page (including `/reset-password` and the `/account` loading and error screens).
    - `useRouteFocus` focuses the page h1 (or main) once the new route has rendered (`resolvedLocation`), waiting for late headings without stealing focus.
    - Mobile menu: distinct names for the button and panel, an `inert` background, close on outside tap, and focus parks on the toggle after a link.
  - **T23/T24/T31 performance**:
    - ImageTrail is client-only, needs a fine pointer and no reduced motion, uses 96px WebP and is portalled to `<body>`. It's mounted by `AppPage`, `/auth` and `/reset-password`, not the root.
    - CircularGallery: listeners are on its container, the loop pauses off-screen or in hidden tabs, `destroy` deletes textures and loses the context, and the engine rebuilds only when its items change.
    - ProximityText reads before it writes. CurvedLoop's loop stops off-screen and re-measures after fonts load.
  - **T25/T29 assets**:
    - Fonts: subset Latin and Latin Extended WOFF2 via `pyftsubset`, with the TTFs kept as the `format()` fallback, and a preload of the display face (`displayFontUrl`).
    - Homepage photos have WebP `srcset`/`sizes` (`src/app/responsive-images.ts`). The hero has `fetchpriority="high"` and is sized by its 60rem minimum height, so phones still get the 1920w file.
    - The neighborhood cards use the white or ink logo files directly.
  - **Bytes**, as downloaded by a modern browser:

    | Asset | Before | After |
    |---|---|---|
    | Fonts | 715,284 B (3 TTF) | 120,336 B (3 WOFF2) |
    | Trail flowers | 2,095,756 B (PNG) | 6,750 B (WebP, inlined in the trail chunk) |
    | Founder photo | 319,295 B | 17,882 B (640) / 48,642 B (1280) |
    | Hero | 177,574 B | 33,782 B / 47,478 B / 86,704 B (960 / 1280 / 1920) |
    | Event thumbnail | 133,992 B | 9,236 B |
    | Event photo card | 133,992 B | 29,970 B (800w) |
    | Neighborhood photos (7) | 1,268,649 B | 337,954 B at 480w |
    | Card logos | 392,979 B (7 coloured, inverted) | 107,314 B (white + ink) |

    Phones pick the 1920w hero (86,704 B), because the hero is at least 60rem tall. The main chunk is 328.38 kB (was 330.40 kB).
  - **Visual changes for owner review** (WCAG ratios; large text needs 3:1, small text 4.5:1, UI borders 3:1):

    | Element | Before | After |
    |---|---|---|
    | Primary button fill (white text) | sky `#1f8ad6`, 3.71:1; hover brightens | new `--bl-sky-strong` `#1b7abd`, 4.60:1; hover darkens to 95%. `--bl-sky` is unchanged (hero, rings, accents). |
    | `ink-faint` (mission statement fade, idle tabs; `.tone-light` too) | `#b9b9b4`, 1.92:1 on canvas | `#92928d`, 3.04:1. Night `#5c5c5c` (3.14:1) unchanged. |
    | Input placeholders | `ink-faint` `#b9b9b4`, 1.92:1 on canvas, 1.79:1 on surface | `ink-muted` at 85%, blended over each background: `#6c6c6b` on canvas (5.12:1), `#6a6a6b` on surface (4.90:1) |
    | Admin tabs on phones | 20px | 24px, so idle tabs count as large text |
    | Homepage card titles: LIC `#2f9dff`, Astoria `#ff9a1f`, Elmhurst `#12d9bd`, Forest Hills `#5fd35f` | white, 2.84 / 2.12 / 1.80 / 1.91:1 | black, 7.39 / 9.89 / 11.69 / 10.97:1; the logo on those cards switches from white to the ink file (`#1f1f1c`, at least 5.81:1). Sunnyside (3.71), Jackson Heights (3.08) and Rego Park (3.42) stay white. |
    | Catalogue card number (on the neighborhood colour) | `#fcfcfa`: LIC 2.77, Sunnyside 3.61, Astoria 2.07, JH 3.00, Elmhurst 1.75, FH 1.86, Rego 3.33:1 | `#000000`: 7.39, 5.66, 9.89, 6.81, 11.69, 10.97, 6.14:1 |
    | Catalogue neighborhood label (colour on the card) | on `#fcfcfa`: same as the number row | on `#000000`: same as the number row. The card is always `tone-night`: no change on `/members` (already a night panel); the `/account` preview card turns black to match the directory. A neutral card's number goes from `#fcfcfa` on `#f2f4f7` (1.07:1) to white on `#121212` (18.73:1). |
    | Mobile menu button border | 25% of the text colour: 1.68:1 on the light bar, 1.41:1 white over the hero sky | 55% ink on the light bar (3.75:1); full white over the hero (3.71:1 on sky) |
    | New, visible only on keyboard focus | none | sky focus rings on Tabs and Accordion; "Skip to content" link; "Pause ribbon" button |
  - **Deviations and notes:**
    - Inactive tab panels exist but stay empty until selected.
    - The trail also renders on `/auth` and `/reset-password` (no `AppPage`) but no longer on the showcase pages.
    - Showcase-only images (demo members, `flower.png`, `portrait-*.jpg`) were left as they are.
  - **Still open:**
    - ~~The CurvedLoop rings still move with no pause control.~~ Phase 7: they stop on their own after 5 s.
    - No `<picture>` JPEG fallback for browsers without WebP: won't fix, every current browser supports WebP.
    - The subset fonts cover Latin, Latin Extended and Vietnamese. Other scripts fall back to system fonts.
- [x] Phase 6 (Tooling, 2026-11-08): T21 and T33–T38.
  - Lint 0/0; dependencies sorted and pinned; `seroval` fixed; native tsconfig paths; `test:db`; `.env` secret guard and `.env.example`; README secrets, migration workflow and CI sections.
  - CI: `.github/workflows/check.yml` runs on pull requests and pushes to non-`main` branches: `bun install --frozen-lockfile`, typecheck, lint, test, build, and a `postgres:17` job for `drizzle/test/run.sh` (opt-in `TEST_DB_EXISTING=1` mode). Actions are pinned by SHA.
  - Security headers via `src/start.ts` (see T38).
  - Notes:
    - Static assets are served by the Workers assets binding before the Worker, so they don't get the headers. A `public/_headers` file could add `nosniff` there if wanted.
    - `vite preview` can't serve this build (the Cloudflare plugin runs only on `build`); use `bunx wrangler dev -c dist/server/wrangler.json --local` to run the built Worker.
- [x] App code: members-only directory, `/admin`, join form submit, neighborhoods from data (Phases 1–3)
- [x] Phase 7 (Cleanup and leftovers, 2026-11-08): T10, T11, T13 and T18 finished; T2–T7, T12, T19 and T30 ticked after checking. Every task is now done or won't fix; what's left is under Owner decisions.
  - [x] Step 1 (`b8117e5`), task-list truth: T2–T7, T12, T19 and T30 ticked after checking code and `rls.sql` (10 new checks for T2–T7, run against deliberately broken copies of 0001 to show they fail); `/account` shows the headshot booking status (T6).
  - [x] Step 2 (`23b6519`), migration `0004_cleanup.sql`: no `'Long Island City'` default (T11); an admin approving or declining a profile directly gives the user's newest application the same status, `reviewed_at` and `reviewed_by` (`pg_trigger_depth() = 1` + `is_admin()`, so application → profile changes never echo back; resetting to pending doesn't sync). 102 RLS checks. **0004 must be applied live with this code** (Owner decision 3).
  - [x] Step 3 (`b8d5295`), initials for portrait-less cards (T10): `MemberProfile.image` is optional; `MemberCard` draws an aria-hidden initials mat; `initials()` lives in the design system; the home gallery keeps only real portraits. On the mat, grid/featured cards drop the photo scrim and use a soft ink neighborhood badge (white glass fails contrast there).
  - [x] Step 4 (`177c521`), member detail dialog with bio, looking-for and website (T13): `MemberDialog` in the design system and `MemberCard`'s `onOpen`.
    - Main chunk 253.42 kB (was 253.36 kB; the card trigger) + 59.54 kB `matchContext`.
    - **New UI for owner review:** catalogue cards on `/members` (both audiences) and in the `/account` introductions now open a member profile dialog: name, role · business, neighborhood, bio, "Looking to meet" and website (a link only for http(s), opening in a new tab). The card looks the same; it is now one button named "View {name}’s profile", with a two-tone focus ring. The dialog is a native modal `<dialog>`: the page behind it is inert and doesn't scroll, Escape, the close button or a backdrop click close it, focus returns to the card, and its entry motion is off under reduced motion.
  - [x] Step 5 (`5b4b37b`), `account.tsx` split into sections (T18): 382 → 139 lines; `AccountHeader`, `PublicCardSection`, `GatheringsList`, `HeadshotBooking`, `IntroductionsSection` in `src/features/account/`. Route tests unchanged, and the page DOM in four states is byte-identical before and after.
  - [x] Step 6 (`ca14bb9`), CurvedLoop rings stop on their own (WCAG 2.2.2; Phase 5 leftover). Chosen over a pause control because the rings are decorative and `aria-hidden`, and the Ribbon's toggle is local to the Ribbon (no global switch to reuse). They animate for at most 5 s of on-screen time (off-screen time doesn't count; one frame adds at most 100 ms, so a throttled tab doesn't either), then rest and never restart by themselves. Reduced motion stays static; dragging still works. The budget is per ring: a newly scrolled-in card still moves for its own 5 s.
  - [x] Step 7, docs: this list, `ARCHITECTURE.md` (§1.3, §1.4, §2.2, §2.6, Part 3), README go-live order, `AGENTS.md` and `DESIGN.md` (then `.lovable/system.md`).
  - Also (`787be6d`): `src/app/join-route.test.tsx` was flaky under load. `getByLabelText` costs ~0.4 s per call on the ~110-label form, so the first test passed its 20 s timeout, and its still-open `act()` blanked the next tests' renders. A one-pass label lookup brings each `/join` test under 0.4 s; the 20 s timeout is gone, and the full suite runs in about 15 s.
