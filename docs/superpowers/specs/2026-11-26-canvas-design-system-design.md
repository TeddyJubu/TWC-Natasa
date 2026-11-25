# Canvas design system on every page

Date: 2026-11-26. Source: `docs/design-canvas/` (the canvas export, tokens verbatim).

## Intent
The user wants the design canvas's system ("01 Programme") on every active page, public and signed-in. The canvas wins every conflict with the current look, with two exceptions the user set:
- **Archivo on white.** Faces stay Archivo (headings 800 at 75% width) with IBM Plex Mono for labels. The ground is white `#fff` and the ink `#111`. No serif faces, no cream ground, no paper grain (user's answer, 2026-11-26; owner decision 2026-11-24).
- **Content rules stand.** No member card, photo or price reaches a public page, there are no links to legal pages that don't exist, `[BRACKETED]` facts are dropped, and motion that starts on its own stops within 5 s or can be paused.

## Sub-projects (in order, each shipped on its own)
1. **Foundation:** tokens, shared `twc-*` styles, the site header and footer, Join, and the new logo everywhere. This spec covers it in detail.
2. **Public pages:** the canvas sections (constellation bands, tiles, event rows, stepped cards, panels, map, calendar) on home, about, events, booking, neighborhoods, FAQ, contact and partnerships. The old decorative pieces (stamp, polaroid, scallop, ribbon, ticket) are deleted.
3. **Form pages and sign-in:** canvas form pieces (pill inputs, numbered question lists) on `/join`, `/review`, `/spotlight`, `/f/<slug>` and auth. The bare pre-launch header and footer stay.
4. **Signed-in pages:** the canvas working views replace airmail on `/account`, `/directory`, `/feed` and `/admin`. DESIGN.md's airmail sections and their tests are rewritten.

## 1. Foundation

### Tokens (`src/styles.css` `@theme`, colours as `--color-sb-*`)
- **Role names keep their names, with new values.**
  - `sb-ink` `#111111` and `sb-paper` `#ffffff` are unchanged.
  - `sb-muted` becomes `#5c5751`.
  - `sb-blue-ink` (links, Join, focus) becomes cobalt `#1f2bd8`.
  - `sb-cream` (light grounds) becomes `#e7ecf2`, the Programme stone, cool rather than warm.
  - `sb-danger` becomes wine `#93313a`.
- **Hue names are replaced by the canvas names.** `tomato`, `sky`, `blush`, `butter`, `lime`, `cobalt`, `khaki`, `slate`, `wine`, `sage`, `lilac`, `grey`, `stone-rule`, `stone-shelf`, `hairline`, `card-ground`, `band-lime`, `band-purple`, `band-red` (**`#ec4a43`**, lightened so ink passes AA), `band-butter`, `band-grey`, `map-water`, `map-peach`, `map-park` and `ev-*`. The Programme override values are used where they exist.
- **Old hue tokens map to new names** (every use is renamed): sun → butter, mint → lime, rose → blush, mustard → band-butter, terracotta → tomato, olive → sage, shell → grey, blue → sky, night → ink.
- **Shape and motion live in twc.css `:root` as `--twc-*`.** That covers spacing 8–120, radii (flag 4, image 28, card 34, pill 999), borders (1, 1.5, 14), shadows (band, event, hard 6px, arch), tilts, and the canvas motion recipes on `cubic-bezier(.22,1,.36,1)`.
- **Fonts.** Caveat and Fragment Mono are removed. `--font-script` points at Archivo and `--font-fragment` at IBM Plex Mono, until sub-project 2 removes the classes that use them.
- **Unchanged:** the internal pages' `.air` overrides keep airmail intact until sub-project 4. The design-system theme (`--bl-*`, the showcase) isn't touched.

### Shared styles (`src/app/twc.css`)
| Class | Spec |
|---|---|
| `twc-btn` and variants | Canvas pill: 1.5px border, 11×22, 600 14px sentence case, press scales to .97, min height 44px. Default is ink fill; `--outline`; `--blue` cobalt; `--paper`; `--sun` becomes butter; `--danger` becomes wine; `--sm` is 12px tracked capitals |
| `twc-chip`, `--ring` | 12px pill with a 1px ink outline |
| `twc-flag` (new) | Dashed Plex Mono label, 4px corners |
| `twc-eyebrow` | 12px, 600, capitals, tracking .16em. `twc-eyebrow-script` renders the same |
| `twc-index` | Plex Mono 11px, .08em |
| `twc-display` / `h2` / `h3` | `clamp(3rem,7.4vw,6.4rem)/.92`, `clamp(2.4rem,5vw,4rem)/.95`, `clamp(1.8rem,3vw,2.75rem)/1` in Archivo 800 condensed |
| `twc-lede` | 17px muted, max 52ch |
| `twc-page` | 15px/1.45 |
| `twc-input`, `twc-label`, `twc-choice`, `twc-check` | Pill input with a 1.5px ink border, square textarea, 12px tracked labels, outline choice pills that fill ink when checked, 2px ink focus ring |
| `twc-notice` | Stone ground; the danger version uses wine |
| `twc-card` | White, 34px corners, 1px hairline border |
| `twc-link` / `twc-inlink` | Underline offset 4px; inline links in cobalt |
| `twc-band--*` | cream → stone, sun → butter, mint → lime, night → ink |
| Old decorative pieces | Moved onto the new tokens; deleted in sub-project 2 |

### Header, footer, Join, logo
- **`AppNav`.** The canvas Programme header:
  - The lockup sits on the left, the links and the Join pill on the right, and the current page is underlined.
  - Below lg there is the lockup, compact Join and the menu.
  - The bare version shows the centred lockup.
- **`AppFooter`.**
  - A giant "find your people." in Archivo 900.
  - Then Plex Mono columns: the name with "share what you do & help someone else shine"; Constellations with the two live areas (North Brooklyn · Queens); the site links.
  - No legal column. The bare version keeps the giant line and the name.
- **`JoinButton`.** The cobalt pill, with the same words, the same plain `/join` and the arrow.
- **The new three-star mark is the canonical logo.**
  - `ConstellationLogo` keeps its API and draws `mark-ink` or `mark-white` (128w and 256w WebP).
  - The lockup is `twc-ink.webp`.
  - Neighborhood-coloured logos become the mark as a CSS mask filled with `bg-(--hood)`. The halftone neighborhood files are deleted; uploaded neighborhood logos are unchanged.
  - The favicons are regenerated from the mark on a white tile.

### Tests and docs
- `contrast.test.tsx` checks every new text pair, including ink on `band-red`, cobalt on white and muted on stone.
- `app-layout.test.tsx`'s join-button, bare-chrome and no-legal-pages checks keep passing.
- The brand and tone tests follow the new logo.
- AGENTS.md and DESIGN.md describe the new look and logo.
- Typecheck, lint, tests and build run under Node 22 before pushing to `main`.
