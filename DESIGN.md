# The Women’s Collective Design System

The Women’s Collective is warm, direct, and editorial: full-bleed sky photography, an elegant serif (Gilda Display) over a clean sans (Inter), soft grey pill badges, and dramatic shifts into pure black "night" sections with a domed top edge. The uploaded halftone constellation is the canonical logo. Its seven neighborhood colors express distinct local identities while the central star represents where the community meets. Sunflower yellow appears only as a small highlight (ribbons).

## Live public site (scrapbook)
The public pages (`/`, `/about`, `/members`, `/members/:slug`, `/gatherings`, `/neighborhoods`, `/faq`, `/contact`, `/join`, `/auth`, legal and status pages) follow the scrapbook design canvas, not the component rules below. Those rules still govern the design-system components themselves and the `/components` showcase.
- Kit: `src/app/twc.css` (`twc-*` classes on the `sb-*` tokens) and `src/app/layout/twc.tsx`; chrome is the prop-less `AppNav`/`AppFooter`. Reference page: `src/routes/index.tsx`.
- Type: Gilda Display for headings in **sentence case** (never bold), a lowercase Caveat line above many of them (`twc-eyebrow-script`), Instrument Serif italic for stamp and value titles, Geist for body, Fragment Mono for indexes and ticket meta.
- Colour: paper `#fcfcfa` ground; cream, sun, night, mint and lilac bands joined by `Scallop` dividers; stamp cards in olive, mustard, rose, shell and terracotta; neighborhood colours only through `--hood`. Small blue text is `sb-blue-ink`; `sb-blue` only at 24px and up.
- Shapes: pill buttons and chips (`twc-btn`, `twc-chip`), polaroids, arched and disc photos, wavy-edged stamps, the admit-ticket CTA, 6px cards and fields.
- Motion: CSS only, every looping animation has a pause control (`TwcRibbon`, the home page's pause button) and stops under reduced motion.
- Facts: a `[BRACKETED]` placeholder on a board is an unknown fact — drop the element rather than invent one. No stand-in photos: members without a portrait get an initials mat; neighborhoods without a photo get a colour + logo tile. Stock photography lives in `src/assets/photography/site/` with `CREDITS.md`.

## Setup
- Import `src/design-system/styles/theme.css` right after `@import "tailwindcss";`.
- Fonts are self-hosted in `src/design-system/assets/fonts` and loaded by the canonical theme file.
- Dark mode: add `dark` to `<html>`. Any block can go dark locally with `Section tone="night"` or the `tone-night` class — all tokens invert inside it.
- Import from the barrel only.

## Hard rules
- Token utilities only (`bg-canvas`, `bg-surface`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `bg-sky`, `bg-sun`, `border-line`). No raw hex or Tailwind palette colors. The exceptions are colors that are fixed rather than themed:
  - Plain `white` and `black`, with opacity where needed: type, rules and glass over photography and night chrome; black scrims behind type on photos; black type on bright neighborhood and accent fills where white fails contrast; the fixed fills of the `white` button and `solid` badge; the black contact-sheet panel.
  - Neighborhood colors are data (hex in the `neighborhoods` table, with a hex fallback list in `src/features/neighborhoods`) and reach app UI only through `--hood`. The theme's neighborhood tokens (`bg-lic`, …) are for the constellation and specimens.
  - `CircularGallery`'s WebGL text colors are plain values, because canvas text can't read CSS tokens.
- Serif for headings, big numbers and wordmarks; never bold it — weight 400 only. Sans for everything else.
- Every public section opens with a `Badge` above a centered serif `Heading` (use `SectionHeader`).
- Public pages start with `Hero` (photo, glass badge, white headline left, short copy right, thin white rule, glass info card + big stat).
- Rhythm: light sections → `tone="dome"` black panel → `tone="night"` continuation → light again. Don't scatter random greys.
- Buttons have 12px corners (`rounded-control`), not pills; badges are pills. Cards use `rounded-card`.
- Yellow (`sun`) only for ribbons/small highlights, never large fills or body text.
- Forms follow an editorial zine language: numbered sections, fine rules, serif emphasis, and asymmetrical multi-column compositions. Use `FormSection` to group long applications.
- Use `editorial` fields on feature forms and `boxed` fields in compact utility contexts. Never mix both field variants within one form.
- Mint, lilac, and signal orange are supporting editorial accents for selected states and specimen panels; keep them subordinate to canvas, ink, and photography. Neighborhood tokens are reserved for constellation and location-led storytelling.
- No inline styles for design decisions; vary via `variant`/`size` props. Two exceptions: (1) data-driven neighborhood color arrives as one inline CSS variable `--hood` (via `MemberCard`'s `tone` prop, or a `hoodStyle()` helper in app code) and is consumed only through the static utilities `bg-(--hood)`, `text-(--hood)`, and `border-(--hood)`; (2) styling computed at runtime that no utility can express: `BorderGlow`'s gradients, masks, blend and glow, `ProximityText`'s per-letter transforms, the `Tabs` grid sized by its item count, and the mobile menu's body scroll lock.
- Motion is editorial and purposeful: shared reveal, stagger, panel, hover, and feedback patterns only. Never add decorative motion that competes with content. Anything that moves on its own stops within 5 s (`CurvedLoop`) or offers a pause control (`Ribbon`).
- Use `Reveal` for viewport entry and `Stagger` for short sequenced groups; both preserve content and honor reduced-motion preferences.
- Long applications use `FormProgress`, `FormSection`, `ChoiceGroup`, `FormNotice`, and `FormActions`; conditional follow-ups reveal directly beneath their controlling choice.
- Member directories use the `MemberCard` catalogue variant in a dense black contact-sheet panel; each card carries its neighborhood color, passed in through the `tone` prop, as a quiet signature (header rule, catalogue number, neighborhood label, and portrait mat), and portraits begin monochrome to reveal color on hover. Members without a portrait show their initials on a neutral mat, never a stand-in photo. Give cards `onOpen` and render one `MemberDialog` per page to open a member's full profile.

## Internal pages
Signed-in pages (`/account`, `/admin`, and any new page behind sign-in) are a settings app in the scrapbook kit's clothes: the same structure as before, restyled with the `twc-*` vocabulary. They use the app shell from `src/app/layout/` and never the public page rhythm (no bands, scallops, ribbons, polaroid heroes or the site header/footer). Public pages never use the app shell.
- Chrome: `AppShell` (paper sidebar with the constellation logo; Collective, My account and — admins only — Admin groups under `twc-eyebrow` labels; pill nav links, black when current; Sign out at the bottom; the same nav in a modal `<dialog>` drawer below lg) and a sticky `TopBar` with the page title in Gilda Display and who is signed in. `/account`'s Save/Preview live in a sticky bar at the bottom.
- Type: Gilda Display for the page `h1` (the member's name on `/account`, the top-bar title on `/admin`; 44px, 34px on phones) and card titles (26px), never bold; a Caveat "welcome, neighbor" line on `/account`; `twc-eyebrow` for row labels and table headers; Geist for values and body.
- Colour: the `app-*` tokens — `bg-app` (paper: sidebar, top bar, cards), `bg-app-sunken` (cream: page background, sub-panels, date tiles), `border-app-line` / `divide-app-rule` (ink 15%), `text-app-muted`, `text-app-accent` (blue-ink links), `bg-app-pending` (sun: under review / requested chips) and `bg-app-ok` (mint: approved / confirmed) — plus `ink`, `ink-muted`, `canvas` and `danger`. Each has a dark value; every text pair is in the contrast test (blue-ink on mint fails, so links in mint notices are ink).
- Vocabulary: content sits in `Card`s (an `id` makes one a sidebar anchor), as label/value `Row`s, item rows with a `Chip` (`twc-chip--ring` in pending, ok, declined or muted tones) or a table in a focusable, labelled, `relative` scroll region. Controls use `primaryButton`/`secondaryButton`/`fieldClass`/`linkClass` (pills, `twc-input`, blue-ink links), `EditButton` (`twc-btn--outline --sm`) and `Toggle`; 6px cards and fields, pill buttons, chips and nav links.
- States: before approval, Gatherings, Headshot session and Introductions show the locked panel ("Unlocks once you're welcomed in"), linking to `/join` only when she has no application; headshot requests show cream / mint / rose notices for requested / confirmed / declined.
- Layout: page column `max-w-250`, gutters `px-4` on phones and `sm:px-8`; cards stack with `gap-6`. Nothing scrolls sideways at 375px except a table inside its own region.
- Motion: colour transitions, the switch knob and the `twc-btn` hover lift, all off under reduced motion.

## Accessibility
- White text on photos needs the built-in gradients (`bg-sky-fade`, card overlays); don't remove them.
- `text-ink-faint` only on large text (24px+; 3:1 on canvas) — fading statements and idle tabs; never small or essential body copy. Placeholders use `ink-muted` at 85%.
- Primary button fills use `bg-sky-strong` (white text 4.6:1); `sky` stays for hero sky, rings and accents.
- Keep focus rings; wrap inputs in `FormField`.
- Associate hints and errors with their controls using `aria-describedby`; mark invalid controls with `aria-invalid`.

## Voice
Warm, direct, and full of personality. Speak like a neighbor inviting someone into a conversation. Celebrate women’s work, make introductions generously, and give members a reason to participate. Keep headlines short: Title Case inside design-system components, sentence case on the live public site.
