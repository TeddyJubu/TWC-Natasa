# Apex coming-soon page

The static page served at https://thewomenscollective.club/ until the full site launches. It is not part of the app's
build: nothing in `src/` imports it, and the app never serves it.

It is restyled in the main site's newer direction: a white page, near-black text, Archivo variable (self-hosted), the
constellation logo and the star trail that follows the cursor (off for touch and reduced motion). The five constellation
tiles appear in this order: North Brooklyn, Western Queens, Brownstone Brooklyn, Uptown Manhattan, Downtown Manhattan.
Only North Brooklyn is a link, to `/join?area=north-brooklyn`. The other four are plain list items marked "Coming soon".
No neighborhood list, no third-party requests, no inline event handlers.

## Files

| File | What |
|------|------|
| `index.html` | The page, with its CSS and JS inline |
| `archivo-latin-wdth-normal.woff2` | Archivo variable, latin subset, wght 100–900 and wdth 62–125 (`@fontsource-variable/archivo` 5.3.0) |
| `archivo-OFL.txt` | The font's SIL Open Font License, which must ship with it |
| `the-womens-collective-ink-128.webp`, `-256.webp` | The constellation logo (copies of `src/design-system/assets/logos/`) |

The favicon and the og:image still point at `/assets/brand/…`, which is already on the server.

## Deploy (VPS)

It replaces `/opt/nbwc/site/index.html`. Back up the old one first:

```sh
cp /opt/nbwc/site/index.html /opt/nbwc/site/index.html.bak-$(date +%Y%m%d)
cp index.html archivo-latin-wdth-normal.woff2 archivo-OFL.txt \
   the-womens-collective-ink-128.webp the-womens-collective-ink-256.webp /opt/nbwc/site/
```

The asset paths are relative, so the files must sit next to `index.html`. To roll back, copy the `.bak-*` file back.

Before going live, check that the server sends `.woff2` as `font/woff2` and `.webp` as `image/webp`.
