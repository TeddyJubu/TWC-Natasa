# Verify sweep (Haiku), 2026-11-09

**Result: not green.** `bun run migration:check` exits 1.

## Counts (902 items)

| status | before | after |
|---|---|---|
| todo | 801 | 802 |
| built | 101 | 65 |
| verified | 0 | 35 |

## How it was checked

- Read `migration/BRIEF.md`, `AUDIT-TASKS.md`, `migration/redirects.md`, `scripts/migration-check.ts`, and every `built` item with its `evidence` (120 items carry evidence: 101 built, 19 todo).
- **Live:** `bun scripts/smoke-cutover.ts` (GET only, no forms posted) returned **48/48 ok** today. The Caddy snippet, `redirects.md` and the smoke script agree.
- **Tests:** after `bun install --frozen-lockfile`, vitest ran 10 files / 158 tests (forms, member links, Beehiiv, legacy import, forms import, cutover redirects) and 6 files / 66 tests (contact, partnership, fellowship/partnerships, about/FAQ, review route). All pass.
- **Code greps** for the claims in evidence: token hashing, CSP origins, no WebMCP, no partners block, no fellowship CTA on `/gatherings`.
- Every item's `acceptance` is the same sentence ("behaviour from X is present on the new app (or deliberately retired), checkable without inventing facts"). Nothing was verified on that sentence alone. An item moved to `verified` only when its own evidence named a concrete behaviour I checked.

## Promoted to `verified` (35)

Redirects, proven by the live smoke (48/48) and `cutover-redirects.test`:
- **SITE-004** directory(.html) → `/members`
- **SITE-014** thanks-contact(.html) → `/contact`
- **SITE-016** thanks-partnership(.html) → `/partnerships`
- **SITE-100** tidy `/about` URLs redirect
- **SITE-115** page redirects drop the query; `/review?t=` keeps it
- **SITE-153** the Caddy redirect mechanism is live
- **SITE-162** tidy and `.html` both redirect for all 15 page rows
- **SITE-163** `/members/*` → `/members` (not the homepage)
- **SITE-164** `/apply(.html)` is one 301 hop to `/join`
- **OPS-008** legacy `join.*`, `forms.*`, `members.*/review` and `nbwc.site/apply` land on the app

Pages and copy, checked by route tests:
- **SITE-006** `/fellowship` exists; fellowship(.html) redirects
- **SITE-007** `/partnerships` exists with the partnership form; partnerships(.html) redirects
- **SITE-044** "Before you write" aside present
- **SITE-148** `/fellowship` links to `/faq`, `/about` and `/code-of-conduct`; no eligibility copy
- **SITE-056** partnership inquiries stored through `/api/partnerships`
- **SITE-057** five collaboration types
- **SITE-169** contact stored in `inbox_messages` before email
- **SITE-170** honeypot, required consent, 5 per IP per 10 min
- **SITE-171** one inbox table, `kind` contact|partnership, business optional

Forms, member links, Beehiiv consent and legacy import, checked by passing tests:
- **CRM-171**, **OPS-087** review-link tokens stored as SHA-256 only
- **CRM-084** minting retires the previous live link
- **CRM-173** same-second, same-email applications both import
- **CRM-031** origin labels
- **CRM-182**, **OPS-118**, **OPS-520** Beehiiv subscribes only with explicit consent (newsletter yes AND email consent)
- **OPS-143** prefill with gaps filled from the approved application
- **OPS-195** a filled honeypot gets the same 204 and nothing is stored
- **OPS-205** only the form's own question keys are stored
- **OPS-241** a closed form returns 410
- **OPS-244**, **OPS-479** 10 per visitor per form per 10 min; the 11th gets 429 without reading the body
- **OPS-249** a duplicate email gets 409
- **OPS-519** the CSP is same-origin only (no Google Fonts or Turnstile origins)

## Reverted to `todo` (3)

- **SITE-041**: no fellowship CTA on `/gatherings`. The link sits on `/fellowship`.
- **SITE-043**: no current-partners block, by decision. Blocked on partner facts from the owner.
- **SITE-157**: same blocker.

## Moved `todo` → `built` (2)

- **SITE-175**, **SITE-176** (VPS archive): recorded in AUDIT-TASKS at `/opt/nbwc/backups/twc-site-archive-20261109-151319.tar.gz`. Not re-checked from here.

## Stale evidence corrected (21)

21 items still said "repo-ready, not yet applied on the VPS". AUDIT-TASKS and today's smoke both show it applied on 2026-11-09. The line now says so.

## Built items that stay built, and why

- **SITE-106**, **SITE-107**: acceptance text is stale. It says "homepage" and "join.* host", but the decided and live behaviour is `/auth` and one hop to `new.*/join`. Rewrite the acceptance, then verify.
- **SITE-040**, **SITE-133**: deliberately retired. The FAQ and its JSON-LD live on `/faq`, and the evidence says so. Needs a recorded "retired" decision.
- **OPS-389**: acceptance says `reactivate_existing: true`. The code deliberately sends `false`. Same retirement issue.
- **OPS-021**: no `/review/thanks` URL by design. Record the retirement.
- **OPS-020**: acceptance says `POST /review?t=<token>`. Implemented as `POST /api/review`.
- **SITE-110**: "superseded" (per-form thank-you rewrite). Record the retirement.
- **SITE-076**, **SITE-078**, **SITE-168**: the GET/HEAD-only rule is in the Caddy file. The read-only smoke can't exercise a POST, so the stale-form case is untested.
- **SITE-114**: backups and `caddy validate` are recorded in AUDIT-TASKS, not re-checked.
- **SITE-154**: acceptance is "N/A". Should be `retired`.
- **SITE-159**: owner answer on geography still open. Western Queens is the improvisation.
- **SITE-149**: its evidence is the contact test, not the `/partnerships` page.
- **SITE-037**: "four steps" is on `/about`; "about two weeks" is not. Confirm owner intent.
- **CRM-090**: AUDIT-TASKS says "awaits an owner retire". Confirmed there is no WebMCP in `src`, but the retirement is not the owner's to assume.
- Remaining `built` items (CRM-012/024/028/029, OPS-022, OPS-525, and others): evidence is plausible, but I did not check each one against its acceptance.

## Blockers for `migration:check`

1. **867 items not `verified`** (802 todo, 65 built). The gate requires all 902. The largest open areas are OPS (496 todo: custom-forms follow-up, notifications, Spotlight), CRM (166 todo) and SITE (140 todo).
2. **Legacy snapshot missing** in this worktree: `.migration/legacy/site` (gitignored). The gate exits on this alone.
3. **Gate defect:** `routeExists("/account")` searches only the root of `src/routes/`, but the route is `src/routes/_authenticated/account.tsx`. Once the snapshot exists, `editing.html → /account` fails unless a `built`/`verified` SITE item covers it. SITE-008, SITE-151 and SITE-172 are all `todo`. Either add an `_authenticated/` candidate in `scripts/migration-check.ts`, or verify SITE-008 (its redirect is live). Not changed here, since the gate is outside the manifest.
4. **25 retired items** still need `verified`. The gate has no retirement exemption.
5. **Done-definition gaps the gate doesn't cover:** `/f/*` still runs on the old stack (OPS-518 held; the live CRM has 0 custom forms). `admin.*` and `crm.*` cutovers are not enabled (CRM parity open). No old timer or container is stopped.

## Not done

- Nothing was verified without a check named in its evidence.
- Nothing pushed; no PR.
- `node_modules` installed locally (gitignored).
