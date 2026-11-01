# URL imports on the GPU canvas, second round

Imports scored ≥ 0.95 in the HTML render and lower on the GPU canvas. Each gap was traced band by
band (`scripts/url-import/gpu-fidelity.ts`) to a GPU-only divergence.

## What changed

- `fontkit-face.ts`: variable fonts without HVAR move advances through gvar phantom points;
  fontkit kept the default advances. Shaping now adds the phantom-point delta per glyph
  (Webflow's variable sans at opsz 24 was 5% narrow, spaces 0.21 em instead of 0.26).
- `display-list.ts`: a mask on a group (precomp) was ignored. The run of clips a masked group
  holds is drawn inside one group item carrying its masks; one per clip made 470 layers on
  Framer and came out white.
- `display-list.ts`: parent cuts (`clipContent`) are applied per group level, each with that
  level's group matrix, as the HTML render cuts each group layer. Before, a component instance
  placed elsewhere was cut to its main's box (Vercel's product shots vanished) and cuts outside
  the nearest group were dropped (Framer's panels overflowed).
- `media.ts`: pictures inside group items were never loaded.
- `import-url.ts` / `upload.ts`: font files are fetched with the page as referer; Apple's font
  host answers 403 without one.
- GPU harness: draws text with plain smoothing, as the headless shell renders the sources.

## Not yet

- Page views (tablet, phone) in the GPU harness wait for the breakpoints import.

## SSIM on captures `v4` (HTML / GPU, fold and full page)

| page | fold | full |
|---|---|---|
| apple | 0.991 / 0.993 | 0.974 / 0.976 |
| blog | 0.974 / 0.961 | 0.966 / 0.971 |
| feega | 0.957 / 0.949 | 0.961 / 0.963 |
| framer | 0.987 / 0.989 | 0.969 / 0.970 |
| linear | 0.986 / 0.989 | 0.978 / 0.980 |
| stripe | 0.989 / 0.980 | 0.980 / 0.971 |
| tailwind | 0.951 / 0.961 | 0.952 / 0.959 |
| vercel | 0.996 / 0.998 | 0.972 / 0.975 |
| webflow | 0.989 / 0.990 | 0.960 / 0.958 |
