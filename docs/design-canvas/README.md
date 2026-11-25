# TWC design canvas: extracted design system

Pulled from `The Women's Collective.zip` (2026-11-26): a single 262 KB canvas page (`index.html`, one `<style>` block of ~1,350 lines plus inline scripts), `logos/` and `photos/`. The canvas calls itself **"TWC Design System, Paper theme"**, and a picker in its preview bar switches it between four variations.

- [`tokens.css`](tokens.css): every token block, copied verbatim, with one block per variation. Nothing imports it.
- [`logos/`](logos/): the six logo files from the export (copied as they are).
- Photos are **not** copied. That's 5 MB, and `nbwc-*.webp` are portraits of real, named members. The directory is members-only (owner decision, 2026-11-24), so they stay out of the repo.

## Read this first: conflicts with the live site

The canvas predates or ignores the owner's 2026-11-24 decisions (AGENTS.md, DESIGN.md). Don't port any of these as they are:

| Canvas | Live rule |
|---|---|
| Instrument Serif for every display size (`.d1`–`.d3`, hero, cards, arches, event titles, member names); EB Garamond for everything in 02 Newspaper | Archivo only. No serif faces |
| `--paper:#f6f1e7` cream ground (base theme) | White `#ffffff` ground. No cream |
| SVG `feTurbulence` paper grain on bands, tiles, cards, panels; 02 adds grain to the body | No paper textures |
| Ink `#151414` | Ink `#111111` |
| `.twc-strip`, `.pf-card` member carousels, `.people` directory on public pages | No member reaches a public page |
| Membership arches with prices (`.twc-arch .amt`), `.pkg` packages | Pricing isn't decided. Don't show any |
| 03/04 copy Notion's own UI (its colours, `#2383E2` blue, system font, sidebar chrome) | One brand, not another product's look |

What carries over cleanly: the colour fields, the constellation bands, the pill/flag/tag shapes, the spacing and radius scale, the layout grid and breakpoints, and the motion recipes.

## Foundations

### Colour (base + 01 Programme)

| Group | Tokens |
|---|---|
| Neutrals | `--ink #151414`, `--mute #5c5751`, `--white #fff`, `--paper #f6f1e7` (01 Programme: `#f1f4f8`, mute `#525a66`) |
| Accents | `--tomato #ea5a2c`, `--sky #4fa6de`, `--blush #f6cad5`, `--butter #faf3bf`, `--lime #d5f57b`, `--cobalt #1f2bd8`, `--khaki #c3bfa5`, `--slate #86809a`, `--wine #93313a` (errors), `--sage #3f8d72`, `--lilac #e2c8e8` |
| Stone (shelves, rules) | `--grey #dedcd8`, `--stone #e9e3d7`, `--stone-rule #cfc7b7`, `--stone-shelf #dcd4c4`, `--hairline #d9d9d9`, `--card-ground #acacae` |
| Constellation bands | `--band-lime #63d873` (North Brooklyn), `--band-purple #a685e2` (Western Queens), `--sky` (Brownstone Brooklyn), `--band-butter #f8de6e` (Uptown Manhattan), `--band-red #e8332c` (Downtown Manhattan), `--band-grey #cbc7c6` |
| Map | `--map-water #8ec6ea`, `--map-peach #f4b08f`, `--map-park #63b39a` |
| Event kinds | `--ev-green`, `--ev-mint`, `--ev-sea`, `--ev-peri`, `--ev-sky`, `--ev-violet`; the calendar also maps kinds onto the accents (zoom = tomato, coffee = khaki, panel = lime, market = blush, meetup = butter, workshop = lilac, incubator = cobalt, happy hour = sky) |
| Semantic | `--ground`, `--text`, `--text-mute`, `--surface`. Colour fields (`.twc-band`, `.twc-tile`, `.twc-card` …) reset them to ink-on-paper, and `.on-white` flips them to white-on-ink |

None of these hexes exist in `src/` today. It's a separate palette from the live `sb-*` tokens.

**Contrast, measured (WCAG):** ink on paper 16.3, on tomato 5.3, on sky 6.9, on band-purple 6.2, on band-lime 10.2, white on cobalt 8.8, mute on paper 6.4. **These fail AA:** ink on `--band-red` **4.33** (the band's 16–20px text), Notion mute `#787774` on white **4.48**, and white on Notion blue `#2383E2` **3.88** (14px button text).

### Type

Families: `--font-sans` Archivo variable (wdth 62–125, wght 400–900), `--font-serif` Instrument Serif, `--font-mono` IBM Plex Mono. All three load from Google Fonts; the live site self-hosts its fonts.

| Role | Spec |
|---|---|
| Body | 15px / 1.45 Archivo, `wdth` 100 |
| `.lead` | 17px, mute, max 52ch |
| `.eyebrow` | 12px, 600, caps, tracking .16em |
| `.d1` / `.d2` / `.d3` | serif 400: `clamp(3rem,7.4vw,6.4rem)/.92`, `clamp(2.4rem,5vw,4rem)/.95`, `clamp(1.8rem,3vw,2.75rem)/1` |
| Hero `h1` | serif 400 `clamp(3.6rem,8.6vw,9rem)/.9`, tracking −.025em |
| `.cond` / band name | Archivo 800, `wdth` 62, caps, `clamp(40px,5.4vw,96px)/.84` |
| `.giant`, footer `.big` | Archivo 900, `clamp(5rem,15.5vw,15rem)/.78`, tracking −.055em |
| `.twc-inline` | Archivo 800 caps `clamp(2.2rem,4.8vw,4.6rem)` with a serif-italic `<em>` |
| `.mono`, meta, flags | Plex Mono 10–11px, caps, tracking .06–.08em |

### Space, shape, depth

- Spacing: 8 · 10 · 16 · 18 · 22 · 24 · 28 · 30 · 40 · 60 · 90 · 120 px (`--space-*`). The page gutter `--gut` is 40px, dropping to 20px at ≤1100px.
- Radius: flag 4, image 28, card 34, pill 999.
- Borders: hairline 1px, controls 1.5px, the arch shelf 14px.
- Shadows: soft upward lift on bands and events (`0 -6px 14px / .08`), hard offset ink on the map, photos and member cards (`6px 6px 0 #151414`), and an inset arch rim.
- Tilt: event rows alternate −0.45° / 0.35°; the map sits at −1.4°.
- Breakpoints: `1100px` (one-column header, stacked bands, 3-up tiles) and `600px` (2-up tiles, a single column everywhere else).

## Components

| Class | What it is |
|---|---|
| `.twc-pill` (`.is-solid`, `.is-sm`, `.on-ink`, `.on-cobalt`) | Outline pill button with a 1.5px border, 11×22 padding and 600 14px text. Press scales it to .97 |
| `.twc-flag` | Dashed mono label, 4px corners (marks a placeholder fact) |
| `.tag` | 12px outline pill |
| `.twc-header` / `.twc-nav` / `.twc-logo` | Sticky header. 01 shows the club lockup (`twc-club-ink.webp`, 81px tall) on the left with tabs on the right. The current page is underlined |
| `.twc-band` | Constellation band: a 74px coloured tab (number · name · status) that opens to 530px (1050px in 01) on hover, focus or tap. In 01 it opens like a folder onto a white sheet that holds a star chart (`.starchart`, dashed links between member stars) and a sliding member carousel (`.pslide` / `.pf-card`) |
| `.twc-hero` + `.twc-float` | Centred serif headline with floating 4:5 polaroids under hard shadows. Hidden in 01 |
| `.twc-inline` + `.twc-grid6` / `.twc-tile` | Giant caps sentence with inline chips, then a 6-up grid of 3:4.1 colour or photo tiles |
| `.twc-ev` | Event row: a 4-column grid with tilted, stacked, lifted strips |
| `.twc-cards` / `.twc-card` | Three white 34px-radius cards stepped down 0 / 60 / 120px on a grey ground. `.is-dark` is ink |
| `.twc-arches` / `.twc-arch` | Membership tiers as arch-topped panels on a stone shelf |
| `.twc-duo` / `.twc-panel` | Two colour panels, each with a 3-column info rule at its foot |
| `.twc-field`, `.inp`, `textarea` | Pill inputs with 1.5px ink borders. A square textarea |
| `.twc-qlist` | Numbered question list on hairlines |
| `.twc-map` | Framed, tilted SVG map with a hard shadow |
| `.cal` | Month grid with 1px ink gaps and colour-coded event chips (`.e.<kind>`) plus a `.legend` |
| `.post`, `.chat`, `.rooms`, `.person`, `.pkg`, `.login` | Working-view pieces (feed, chat rooms, directory, packages, sign-in) |
| `.twc-footer` | Giant 900 wordmark over four mono columns |
| `#toast` | Ink pill fixed at the bottom centre |

## Motion

Shared easing `--tw-ease: cubic-bezier(.22,1,.36,1)`. The recipes:

- Toast: in over 350ms, out over 250ms.
- Page enter: 250ms with an 8px rise and blur.
- Staggered rise: 500ms, 40ms between items.
- Sliding tab and filter indicator: 250ms.
- Like pop and particle burst.
- Error shake.
- Digit roll-in.
- Arrow nudge on hover.

Bands open over 0.45s. Photos get an animated film-grain overlay and an orange light leak on hover. Polaroids drift endlessly. Each recipe has a `prefers-reduced-motion` fallback.

Two things are missing. Polaroid drift, star twinkle (`.sc-tw`) and grain loop forever with no pause control, so they break the live rule that motion stops within 5s or has a pause control (WCAG 2.2.2). The film grain also has no reduced-motion opt-out on bands.

## Variations

| | Ground / ink | Type | Shape |
|---|---|---|---|
| 01 Programme (default) | `#f1f4f8` cool grey-blue / `#151414` | Archivo + Instrument Serif | Pills, tilts, hard shadows. The hero is hidden; bands are folders with star charts |
| 02 Newspaper | `#f4f4f2` / `#111`. Every accent goes grey | EB Garamond everywhere, italic giants, mono eyebrows | Square corners, no tilts or shadows, double-rule masthead, dateline, halftone photos |
| 03 Notion | white / `#37352F` | System sans | 4px corners, pastel fills, a 240px sidebar, a 900px column |
| 04 Notion dark | `#191919` panels over the milky-way photo | System sans | Glass panels (`backdrop-filter`) |

## Logos

| File | Use |
|---|---|
| `twc-club-ink.webp` (783×480) | Lockup: three solid stars with "The Women's Collective Club" in heavy caps (the 01 header) |
| `twc-ink.webp` (770×400) | The same lockup without "Club" |
| `mark-ink.webp`, `mark-white.webp` (~170×240) | The three solid stars alone (ink, and white for 04) |
| `star-ink.webp`, `star-white.webp` (280×294) | One halftone shooting star |

The live canonical logo is the halftone constellation (`ConstellationLogo`, `src/design-system/assets/logos/`). The solid three-star mark and lockups are new artwork; adopting them is the owner's call.
