# Visual direction: "Keepsake" — romantic editorial design system

The uploaded blueprint describes the W&R wedding page's structure (layout rhythm, section types, components). It has no colors or fonts, so the visual language is drawn from that reference's style: soft, editorial, romantic. All wedding copy stays out — the system ships neutral placeholder content.

## Look and feel
- **Mood:** an heirloom invitation card. Warm paper, ink-dark text, one muted rose accent, wide margins, slow and quiet motion.
- **Palette (light):** paper `#F7F2EC`, cream surface `#EFE6DC`, ink `#2B2522`, muted ink `#6E625B`, rose accent `#B7797A`, sage support `#8E9A86`, hairline `#DDD1C4`.
- **Palette (dark):** deep cocoa `#1E1916` background, the same accents lifted slightly.
- **Type:** Cormorant Garamond (large display headings, italic for emphasis words) paired with Karla (body and labels). Eyebrows are small uppercase, widely spaced.
- **Shape:** very soft corners on cards, pill-shaped buttons, arch-shaped image frames, thin dividers, almost no shadow.
- **Motion:** gentle fade-and-rise on scroll, soft hover lift, accordion ease.

## Components (taken from the blueprint's section patterns)
- Foundations: Button (solid / outline / ghost / link, sizes sm–lg), Eyebrow, Heading (display / section / title), Text, Divider with an ornament, Monogram mark.
- Layout: Container, Section (eyebrow + heading + intro), Split (image + text), Navbar with a CTA, Footer.
- Content: Hero, Milestone timeline, EventCard (type, date, time, place, image), Countdown, Schedule list (time + title + description + image), Image frame (arch / rounded / circle), Gallery strip, FAQ accordion.
- Forms: Input, Textarea, Select, Radio group, Checkbox, Label, FormField, a full RSVP-style form.

## Showcase
A preview site that is itself a full sample page in this style (hero, story, events, countdown, schedule, form, gallery, FAQ, footer) plus pages for colors, typography, and every component with its variants, with a light/dark switch. Photos are generated to match the warm, film-like mood.

## Knowledge
`system.md` covers the philosophy, hard rules (tokens only, no raw colors, accessible contrast and focus, serif for display only), and voice.

## Technical details
- `.lovable/meta.yaml`: framework react, css_framework tailwind, starter_template custom_design_system, source_type local; `lovable.toml` with `tech_stack = "custom_design_system_tanstack"`.
- Everything lives in `src/design-system/` (theme CSS with `@theme inline` tokens, components, `cn()` helper, `cva`); barrel at `src/index.ts`; `.lovable/sources.yaml` points at the theme CSS and the barrel.
- Fonts loaded via `<link>` in `__root.tsx`. Add `clsx`, `tailwind-merge`, `class-variance-authority`.
- Showcase routes: `/`, `/colors`, `/typography`, `/components`, each with its own head metadata. AGENTS.md records the structure.
