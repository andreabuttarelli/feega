# Layout guides: count, alignment, colour, snapping (LG-01..LG-04)

Guides were stretch-only, red, fixed count, and `guideSnapBounds` existed but nothing called it.

- `layout-guides/model.ts`: `count` is a number or `auto`; `align` stretch|min|max|center;
  `offset`; `color`; `opacity`. Old docs parse unchanged (defaults).
- `guides.ts`: two tables (`AVAILABLE`, `STARTS_AT`) per alignment replace the one formula. Auto
  count fits as many `size` sections as the room holds, capped at 256.
- Snapping: `frame-transform.ts` adds the guide edges to the snap targets of single and group
  drags, not to the spacing measure. Hidden guides still snap (roadmap LG-04); this is a choice
  that can surprise: an invisible magnet.
- UI: `LayoutGuidesSection` (alignment, size/offset, colour, opacity); overlay draws each guide
  in its own colour. MCP: `set_canvas.layout_guides` takes the same schema, description updated.
- Checked in Chromium on test@dazero.co: `~/Documents/feega-videos/e2e/r7-guides-*.png`.
