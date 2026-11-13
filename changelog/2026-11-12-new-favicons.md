# New favicon on app, landing, blog and docs

All four sites showed the old logo (48 px or 400 px PNGs, no SVG, no `.ico`, and the landing used
one 400 px file as both favicon and apple-touch icon).

`scripts/favicons/build.mjs` renders one set from one source (`scripts/favicons/mark.svg`, the
orange mark) into each site: `favicon.svg`, `favicon.ico` (16/32/48), PNG fallbacks, a 180 px opaque
`apple-touch-icon.png`, and in the app the 192/512/maskable manifest icons. Existing file names are
kept so nothing 404s; tags now prefer the SVG.

At 16 and 32 px the exact mark closes its gaps into a blob. The rasters up to 48 px use a variant
whose cutting circles are r=78 instead of 69.5; the SVG and the larger sizes use the exact mark.

Not touched: desktop and Capacitor icons, the extension icon, OG images, `FeegaMark`.
