# Bloom Design System

Bloom is bright and editorial: full-bleed sky-blue photography, an elegant serif (Gilda Display) over a clean sans (Inter), soft grey pill badges with a blossom mark, and dramatic shifts into pure black "night" sections with a domed top edge. Sunflower yellow appears only as a small highlight (ribbons).

## Setup
- Import `src/design-system/styles/theme.css` right after `@import "tailwindcss";`.
- Fonts are self-hosted in `src/assets/fonts` and loaded by the canonical theme file.
- Dark mode: add `dark` to `<html>`. Any block can go dark locally with `Section tone="night"` or the `tone-night` class — all tokens invert inside it.
- Import from the barrel only.

## Hard rules
- Token utilities only (`bg-canvas`, `bg-surface`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `bg-sky`, `bg-sun`, `border-line`). No raw hex or Tailwind palette colors.
- Serif for headings, big numbers and wordmarks; never bold it — weight 400 only. Sans for everything else.
- Every section opens with a `Badge` above a centered serif `Heading` (use `SectionHeader`).
- Pages start with `Hero` (photo, glass badge, white headline left, short copy right, thin white rule, glass info card + big stat).
- Rhythm: light sections → `tone="dome"` black panel → `tone="night"` continuation → light again. Don't scatter random greys.
- Buttons have 12px corners (`rounded-control`), not pills; badges are pills. Cards use `rounded-card`.
- Yellow (`sun`) only for ribbons/small highlights, never large fills or body text.
- Forms follow an editorial zine language: numbered sections, fine rules, serif emphasis, and asymmetrical multi-column compositions. Use `FormSection` to group long applications.
- Use `editorial` fields on feature forms and `boxed` fields in compact utility contexts. Never mix both field variants within one form.
- Mint, lilac, and signal orange are supporting editorial accents for selected states and specimen panels; keep them subordinate to canvas, ink, and photography.
- No inline styles; vary via `variant`/`size` props.
- Motion is editorial and purposeful: shared reveal, stagger, panel, hover, and feedback patterns only. Never add decorative motion that competes with content.
- Long applications use `FormProgress`, `FormSection`, `ChoiceGroup`, `FormNotice`, and `FormActions`; conditional follow-ups reveal directly beneath their controlling choice.

## Accessibility
- White text on photos needs the built-in gradients (`bg-sky-fade`, card overlays); don't remove them.
- `text-ink-faint` is decorative (fading statements, idle tabs) — never for essential copy.
- Keep focus rings; wrap inputs in `FormField`.
- Associate hints and errors with their controls using `aria-describedby`; mark invalid controls with `aria-invalid`.

## Voice
Confident, warm, short. Headlines in Title Case, around five words.
