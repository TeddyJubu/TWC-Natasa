# Keepsake Design System

Keepsake is a romantic, editorial system that feels like an heirloom invitation: warm paper, ink-dark serif type, one muted rose accent, generous margins and slow, quiet motion.

## Setup
- Import `src/design-system/styles/theme.css` right after `@import "tailwindcss";` in the app's CSS.
- Load fonts with a `<link>`: Cormorant Garamond (300/400/500 + italic) and Karla (400/500/600).
- Dark mode: add the `dark` class to `<html>`.
- Import components from the barrel (`@/design-system/keepsake`), never deep paths.

## Hard rules
- Only token utilities: `bg-paper`, `bg-surface`, `text-ink`, `text-ink-muted`, `text-accent`, `border-line`, etc. Never raw hex, rgb or Tailwind palette colors (`bg-rose-300`).
- Serif (`font-display`) is for headings, numbers and monograms only; body and controls use `font-sans`.
- One accent per view region. Rose highlights an eyebrow, one italic word (`<em>` inside `Heading`) or the primary CTA — not all at once.
- Buttons are pills; cards use `rounded-card`; feature images use `ImageFrame` (arch by default). No hard shadows; `shadow-lift` only on hover.
- Sections alternate `Section tone="paper"` / `tone="surface"`; always open with `SectionHeader` (eyebrow + heading + optional intro).
- Motion is gentle: `animate-rise` on entry, `ease-[var(--ease-gentle)]`, nothing bouncy.
- No inline styles. Vary looks through `variant` / `size` props, not className overrides.

## Accessibility
- Keep AA contrast: `text-ink-muted` only on `paper` / `surface`.
- Every control keeps the visible focus ring; inputs always go inside `FormField` with a label.
- Meaningful images need real `alt`; decorative ones `alt=""`.

## Voice
Warm, brief, sincere. Short headlines with one emphasized word; two to three sentence paragraphs.

```tsx
<Section tone="surface">
  <Container>
    <SectionHeader eyebrow="Schedule" title={<>How the day <em>unfolds</em></>} />
    <Schedule items={items} />
  </Container>
</Section>
```
