# The Women’s Collective Design System

The Women’s Collective is warm, direct, and editorial: full-bleed sky photography, an elegant serif (Gilda Display) over a clean sans (Inter), soft grey pill badges, and dramatic shifts into pure black "night" sections with a domed top edge. The uploaded halftone constellation is the canonical logo. Its seven neighborhood colors express distinct local identities while the central star represents where the community meets. Sunflower yellow appears only as a small highlight (ribbons).

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
Signed-in pages (`/account`, `/admin`, and any new page behind sign-in) are a quiet settings app, not the editorial site. They use the app shell from `src/app/layout/` and nothing from the public rhythm above (no `Hero`, `Badge`/`SectionHeader`, dome or night sections, serif headings, or `Tabs`). Public pages never use the app shell.
- Chrome: `AppShell` (sidebar with the Collective, My Account and — admins only — Admin groups, Sign out at the bottom; the same nav in a modal drawer below lg) and a sticky `TopBar` reading "Section / icon Title" with the page's actions on the right.
- Type: sans only. Card titles `text-base font-medium`, rows 15px, secondary text 13–13.5px. The page `h1` is a medium-weight sans: the member's name on `/account`, the top-bar title on `/admin`.
- Colour: the neutral `app-*` tokens — `bg-app` (page, cards), `bg-app-sunken` (sidebar, card heads), `border-app-line` (outlines, controls, active nav), `divide-app-rule` (row dividers), `text-app-muted` (labels, secondary text), `text-app-accent` (links, pending/verified chips), `bg-app-tint` (the account header's warm cells) — plus `ink`, `ink-muted`, `canvas` and `danger`. No new hex; every text pair is in the contrast test.
- Vocabulary: content sits in `Card`s (an `id` makes one a sidebar anchor), as label/value `Row`s, item rows (a `font-medium` name, muted details, a `Chip` on the right) or a table in a focusable, labelled, `relative` scroll region. Controls use `primaryButton`/`secondaryButton`/`fieldClass`/`linkClass` and `Toggle`; 9–14px radii, not `rounded-control`/`rounded-card`.
- Layout: page column `max-w-277`, gutters `px-4` (16px) on phones, `sm:px-8`, `lg:px-12`; cards stack with `gap-6`. Nothing scrolls sideways at 375px except a table inside its own region.
- Motion: colour transitions and the switch knob only, all off under reduced motion.

## Accessibility
- White text on photos needs the built-in gradients (`bg-sky-fade`, card overlays); don't remove them.
- `text-ink-faint` only on large text (24px+; 3:1 on canvas) — fading statements and idle tabs; never small or essential body copy. Placeholders use `ink-muted` at 85%.
- Primary button fills use `bg-sky-strong` (white text 4.6:1); `sky` stays for hero sky, rings and accents.
- Keep focus rings; wrap inputs in `FormField`.
- Associate hints and errors with their controls using `aria-describedby`; mark invalid controls with `aria-invalid`.

## Voice
Warm, direct, and full of personality. Speak like a neighbor inviting someone into a conversation. Celebrate women’s work, make introductions generously, and give members a reason to participate. Keep headlines short and use Title Case.
