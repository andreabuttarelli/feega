# URL import: tablet and phone layouts as breakpoints

A URL import was one desktop frame. Resizing it did not give the page's own tablet or phone
layout, and ADR 0022 breakpoints existed only for hand-made overrides.

## What changed

- `breakpoints: true` (API, MCP `import_url`, CLI `--breakpoints`, dialog checkbox) reads the page
  again at 768 and 390 px with the same freeze (`tab.viewport`, `PAGE_VIEWS`) and writes what
  changed as Tablet/Phone overrides (`page-views.ts`, spec "Breakpoints").
- Layers are matched across widths by DOM path (`RestNode.key`), and clips by the layer they came
  from (`PlanItem.keys`). Replanning the narrower tree and matching clip ids by order was tried
  first: 532 mismatches on feega.app, dropped.
- ADR 0022 gains `layoutItem.absolute`, `props.sizing`, `props.lineHeight`, `props.textWrap`,
  overrides inside compositions, and an optional `Breakpoint.height`.
- Paragraphs split into lines become one wrapping text when breakpoints are on (`joinedTree`);
  layers only the phone shows come in hidden with namespaced ids and their images.
- Components are not marked when breakpoints are on: an instance can sit differently per copy on
  a phone, which per-composition overrides cannot say.
- Chips (inline code with padding) count their boxes when the walker groups text into lines.

## Measured (SSIM fold/full, HTML, capture `v4`)

| page | tablet | phone |
|---|---|---|
| vercel | 0.69/0.89 | 0.69/0.84 |
| linear | 0.55/0.79 | 0.28/0.68 |
| stripe | 0.49/0.80 | 0.53/0.55 |
| apple | 0.93/0.71 | 0.60/0.59 |
| framer | 0.94/0.74 | 0.82/0.75 |
| webflow | 0.96/0.87 | 0.80/0.74 |
| tailwind | 0.94/0.94 | 0.90/0.90 |
| blog | 0.92/0.83 | 0.87/0.41 |
| feega | 0.84/0.87 | 0.70/0.58 |

The base view keeps ≥ 0.95 everywhere. Far from the 0.95 target, so the option stays
experimental and off by default. Known causes: pages that build the narrow layout from other
elements (linear's headline, stripe's logo marquee), pictures cropped differently per width,
phone pages longer than 16,384 px (blog), small vertical drift that banded SSIM punishes.
