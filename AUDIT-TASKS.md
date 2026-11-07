# Audit Task List — 2026-11-07

Merged from five independent, context-free audits: **S** security · **L** logic/flows · **A** architecture · **F** frontend (a11y/perf) · **B** build/tooling.
Tags show which auditors found each issue independently; more tags means more confidence.
Baseline: `tsc` ✅ · `vite build` ✅ (warns on a 585 kB chunk) · `eslint` ❌ 7 errors · `bun audit` 69 vulns (1 runtime).

---

## P0 — Broken core flows & data exposure

- [x] **1. The join form saves nothing.** `MembershipApplication.tsx:50` only sets `submitted=true`. Add an `applications` table (owner insert, admin read), wire up the submit, give the ~20 inputs that lack one a `name`, enforce required `ChoiceGroup`s, and show success only after the insert works. `S L A F`
- [ ] **2. Lock down the `avatars` storage bucket.** The `"Avatar read"` policy (migration :136) lets anonymous visitors list and download every portrait, including pending and declined members. Limit reads to owner and admin, serve directory portraits only for approved + visible members, add an owner delete policy, **create the bucket in a migration** (it's missing now), and set mime/size limits. `S L A`
- [ ] **3. Enforce approval in the database, not just the UI.** Events, RSVPs and bookings policies accept any signed-in user, so pending and declined accounts can read venues and RSVP through the API. Add `and public.is_approved(auth.uid())`. `S`
- [ ] **4. Restrict the functions callable by anonymous users.** `revoke execute` on `has_role` and `is_approved` from `anon`/`public` (right now anyone can find out who is an admin). Stop returning `id` from `public_directory()`. `S`
- [ ] **5. Make deleting a login also delete the member's data.** Add `references auth.users(id) on delete cascade` to `profiles.id`, `user_roles.user_id`, `event_rsvps.user_id` and `headshot_bookings.user_id`. Without it, a deleted user stays listed in the public directory. `S L A`
- [ ] **6. Protect booking status.** Members can set their own `headshot_bookings.status` to `confirmed`. Guard it with a trigger, reset it to `'requested'` when a member changes the booking, and show the status in the UI. `S L`
- [ ] **7. Add database constraints.** Bio and looking-for length, `website ~ '^https?://'`, neighborhood check, and `avatar_path` must start with `id || '/'` (a member can currently point their card at someone else's photo). `S`

## P1 — App correctness

- [x] **8. Account page failure states.** A missing profile row or query error gives an endless spinner with no way to sign out (`account.tsx:63,139`). Handle `declined` status, which currently shows as "In review". Give the spinner `role="status"`. `L A F`
- [x] **9. Stop swallowing errors.** Check the result of `toggleRsvp`, `bookHeadshot` and the profile update after an avatar upload; add busy states. Validate file size and type on the client and reset the file input's value. `L A F`
- [ ] **10. Directory correctness.** Show the stored `catalogue_number`, not `index+1` (add it to `MemberProfile`). Show demo members only when there are no real ones, with the banner and count conditional. Build filter chips from the canonical list, not the demo data. Use initials instead of `hero.jpg` with misleading alt text. `L A F`
- [ ] **11. One neighborhood source of truth.** The list is duplicated in about 8 places, and Woodside/East Elmhurst are inconsistent. Create one module with `{name, slug, color classes, logo}` and a `Neighborhood` type, and derive every map from it. Remove the `'Long Island City'` database default. `L A`
- [ ] **12. Dates and times.** The headshot `min` date uses UTC (`account.tsx:257`). Format events in `America/New_York`. Add an empty state when there are no events. Move the seed events out of the schema migration. `L A`
- [ ] **13. Fields saved but never shown.** Bio, looking-for and website don't appear on catalogue cards, and `website` isn't returned by `public_directory`. The "Live preview" ignores unsaved edits: make it controlled, or rename it. `L`
- [x] **14. Auth flows.** Clear the error and notice on every mode change. Use generic error messages so the form doesn't reveal which emails have accounts. Detect sign-up with an existing email. `/reset-password` should require a `PASSWORD_RECOVERY` session and handle expired links. `S L`
- [x] **15. Introductions query.** It sorts by neighborhood only after `.limit(12)` on unordered rows. Filter or order in the query itself. `L`

## P2 — Architecture

- [ ] **16. Keep showcase code off the live site.** The `Shell` toolbar (Colors, Typography, Dark toggle) shows on `/`, `/members` and `/join`. Add an app layout, and noindex or hide `/colors`, `/typography` and `/components` in production. Update `AGENTS.md`. `A F`
- [ ] **17. Navbar and Footer.** They render plain `<a href>`, so every internal link reloads the page; accept a router link component. There's no mobile menu (`layout.tsx:136` is `hidden md:flex`), so phone users have no navigation. `L A F`
- [ ] **18. Data layer.** React Query is installed but never used, and all data loading is hand-written `useEffect` + `useState`. Either adopt `queryOptions`/`useMutation` in a `src/features/members/` module or remove the package. Split the 296-line `account.tsx` into sections. `A`
- [ ] **19. Design-system boundary.**
  - Fonts load from `src/assets/fonts`, which is outside the design system and breaks attach. Move them into `design-system/assets`.
  - Move the demo data and founder photo out of `design-system/`, and move the `MemberProfile` type into `member-card.tsx`.
  - Import only from the barrel, and enforce that with ESLint `no-restricted-imports`.

  `A`
- [x] **20. Accessible form components.** `FormField` should inject `aria-describedby`/`aria-invalid` itself instead of callers hard-coding magic ids. Give `ChoiceGroup`/`RadioGroup` controlled `value` and real `required` validation. `A F L`
- [ ] **21. Migration workflow.** `drizzle/schema.ts` is empty, so `drizzle-kit push` could drop live tables. Choose SQL-only (remove `drizzle-orm`, `postgres` and `schema.ts`) or properly wire up Drizzle, and document the choice. `A B`

## P3 — Frontend performance & accessibility

- [ ] **22. Fixed positioning bug.** The `.motion-route-in` animation keeps `translateY(0)` applied, so `position:fixed` children (the toolbar, preview frames, any future modal) are positioned against the page instead of the viewport. End the animation at `transform:none`, or animate opacity only. `F`
- [ ] **23. ImageTrail weight.** The server renders 24 `<img>` on every page, pulling about 2 MB of 816px PNGs even on touch devices. Render them client-side only after a pointer check, use ~96px WebP, and reconsider mounting it in the "providers-only" root. `F B`
- [ ] **24. CircularGallery.** It listens on `window` (scrolling anywhere spins it), double-counts `mousewheel`, runs requestAnimationFrame forever, never releases the WebGL context, and rebuilds on every render because `items` is a new array. `F A`
- [ ] **25. Fonts.** About 700 KB of TTF. Convert to subset `woff2` and preload the display face. `F B`
- [ ] **26. Contrast.**

  | Element | Contrast | Needs |
  |---|---|---|
  | Primary sky button | 3.7:1 | 4.5:1 |
  | Neighborhood card titles | 1.8–2.8:1 | 3:1 |
  | `ink-faint` mission statement, tabs and placeholders | about 1.9:1 | 3:1 for the statement |

  Catalogue card number and label fail too. Force `tone-night` on catalogue cards. `F`
- [ ] **27. Motion and screen readers.** The ribbon text is read 12 times and never pauses. CurvedLoop rings have no pause control. The reduced-motion gallery announces each image twice. `F`
- [ ] **28. Semantics.**
  - No `<main>` and no skip link.
  - Heading jumps (h1 → h3 on `/join`).
  - `FormSection` announces its title twice.
  - Tabs `aria-controls` point at ids that don't exist, and arrow keys don't work. The `/auth` tablist has no panels.
  - Missing focus rings on Accordion/Tabs.
  - Focus isn't reset on route change.

  `F`
- [ ] **29. Images.** Add `srcset` and resized variants (the founder photo is 2000px for a ~600px slot). Use the white logo directly instead of inverting seven colored ones. Add `fetchpriority` to the hero. `F`
- [ ] **30. Bundle.** `__root.tsx` imports Supabase, so every marketing page ships the full SDK (main chunk 585 kB). Load it lazily. `B F`
- [ ] **31. Per-card effects.** ProximityText mixes layout reads and writes and sets `will-change` on every letter. CurvedLoop runs requestAnimationFrame off-screen and measures before fonts load. `F`
- [ ] **32. SEO.** `og:image` missing, `twitter:site=@Lovable`, no canonical, robots.txt or sitemap, no custom 404/error page. `F A`

## P4 — Tooling & hygiene

- [ ] **33. Lint.** Fix the 7 lint errors (`circular-gallery.tsx:29`, empty interfaces in `form`, `motion` and `typography`, `previewAuthStorage.ts:38`). Add `typecheck` and `check` scripts. Turn `no-unused-vars` on as a warning. `B A`
- [ ] **34. Dependencies.**
  - `bun update` the TanStack, Vite and Cloudflare packages: **seroval** has a vulnerability that ships at runtime.
  - Move the TanStack runtime packages to `dependencies` and `tailwindcss` to dev (otherwise `audit --prod` falsely reports clean).
  - Add `wrangler` as a dev dependency plus a `deploy` script.
  - Pin versions consistently.
  - Bind the dev server to `localhost` instead of `::`.

  `B A`
- [ ] **35. `.env`.** It's tracked by git, and the build copies it into `dist/server/.dev.vars`. Never put the service-role key in it. Add it to `.gitignore` with a `.env.example` (check how Lovable syncs it first). `B`
- [ ] **36. Path aliases.** Replace `vite-tsconfig-paths` with Vite's native tsconfig paths and drop the duplicate `@` alias. `B`
- [ ] **37. Docs and naming.** Rewrite `README.md`. Make `system.md` match reality (it bans inline styles and raw colors, which components use). Rename the worker and package from template names and bump `compatibility_date`. Remove the unused original logo. Use `state="loading"` in the showcase. `A B`
- [ ] **38. Security headers.** Add CSP `frame-ancestors 'none'`, `X-Content-Type-Options` and `Referrer-Policy` through the Worker. `S`

---

## Decisions (2026-11-07)

1. **Directory is members-only.** Approved members (and admins) see the directory and portraits; anonymous visitors don't.
2. **Applications from both paths.** Anonymous applicants and signed-in members can both apply. An anonymous application links to an account once someone signs up and *confirms* the same email.
3. **Demo members leave the live pages.** Real members are in `profiles`. The fictional set stays only in the `/components` showcase.
4. **Build `/admin`.** It reviews applications and profiles, approves or declines, and manages neighborhoods. The first admin is added by hand: `insert into user_roles (user_id, role) values ('<uuid>', 'admin')`.
5. **Neighborhoods become content.** A `neighborhoods` table holds name, slug, color and an uploaded logo, and admins can add more. Neighborhood colors in app UI come from data via a CSS variable rather than fixed Tailwind classes.
6. **Profile edits go live instantly.** Task 39 (re-review after edits) is not needed.
7. **Public profiles are opt-in (2026-11-08, Phase 2).** A member who switches on "Show my profile on the public website" can be seen on public pages: the homepage gallery and the public view of `/members`. That applies only while she is approved *and* listed in the directory. Everyone else stays members-only. The homepage gallery shows only these members.

## Progress

- [x] `drizzle/migrations/0001_members_only_admin.sql`: tasks 2–7 plus the neighborhoods, applications and admin schema. All 27 checks in `drizzle/test/run.sh` pass. **Not yet applied to the live database.**
- [x] Phase 1 (Foundations, 2026-11-08): `features/` + `app/` folders, lazy Supabase, `useNeighborhoods`, `MemberCard` `tone` prop, ESLint boundaries, Vitest. `/members` and `/account` read and write through TanStack Query (`features/members`, `features/events`) with one shared mapper and visible errors. Neighborhood options and colors come from data. Covers T11, T18 (data layer; splitting `account.tsx` is still open), T19 and T30.
- [x] Phase 2 (Member flows, 2026-11-08): migration `0002_public_profiles.sql` (opt-in `public_profile`, `public_profiles()`, anon portrait reads; 44 RLS checks). `viewerQuery` and `publicProfilesQuery`; `/members` serves approved members the full directory and everyone else public cards with a sign-in or "welcomed in" prompt; the home gallery shows public profiles only; no demo members outside `/components`. Account: public-profile switch, `declined` status, real intros (neighborhood-first in the query), a preview of unsaved edits, avatar type/size checks, New York event times, local headshot date, empty states. Auth: no account disclosure, mode resets, recovery-only password reset. Route tests via Testing Library + jsdom. Covers T8, T9, T14, T15 and most of T10, T12 and T13. **0001 and 0002 must be applied to the live database together with this code.**
  - Still open from those tasks: initials instead of `hero.jpg` on portrait-less cards (T10), moving the seed events out of the schema migration (T12), bio/looking-for/website on catalogue cards (T13).
- [x] Phase 3 (Applications + admin, 2026-11-08): migration `0003_admin_review.sql` (`link_applications()` now gives a still-pending profile the outcome of an already reviewed application, approved or declined, and fires after profile creation so OAuth sign-ups work; one-time backfill; `applications.reviewed_by` set from `auth.uid()` and unforgeable; inserts can't arrive pre-reviewed; `lower(email)` index; 72 RLS checks). `/join` submits for real through `features/applications` (typed answers, `parseApplication` mirroring the DB checks, success only after the insert, Retry on error, prefill for signed-in applicants; logo upload moved to after approval). `FormField` wires id/`aria-describedby`/`aria-invalid` itself; `ChoiceGroup`/`RadioGroup` are controlled and a required group blocks submit with a visible error. `/admin` (guarded by `is_admin()`, own chunk) with Applications, Members, Neighborhoods (logo upload) and Bookings tabs in `features/admin`; admins see the full `/members` directory and an Admin link in the account nav. Covers T1 and T20. **0001–0003 must be applied to the live database together with this code** (see README "Database & go-live").
  - Still open: CAPTCHA/rate limiting for anonymous applications, email notifications on review, logo collection after approval.
- [ ] See `ARCHITECTURE.md` Part 3 for the phase order of the remaining work
- [x] App code: members-only directory, `/admin`, join form submit, neighborhoods from data (Phases 1–3)
- [ ] P1–P4 remainder
