# Grid auto layout v2: tracks, spans, cell alignment, auto flow

Parity roadmap P3. A grid had N equal columns and rows as tall as their
tallest child. Now:

- `columnTracks` / `rowTracks`: `{type: fixed|flex|hug, value}`. Fixed is px,
  flex shares the free space by fr, hug fits the single-span children of the
  track. Empty `columnTracks` keeps the old `columns` equal flex columns;
  missing rows are hug, so every existing grid lays out as before.
- Layout item `column`/`row` anchor a child (0-based), `columnSpan`/`rowSpan`
  span it, `cellX`/`cellY` align it in its cell over the grid's justify/align.
- `autoFlow` row|column: which way unanchored children fill.
- Figma's rule that a flex track is invalid on an axis where the grid hugs is
  enforced in one place (`flexOnHug` in `layout/model.ts`), by both
  `setAutoLayout` and `setLayoutItem`. The engine still sizes flex in a hugging
  axis like CSS (fr unit = largest content/fr), which is what implied columns of
  a hugging legacy grid need.

Properties: column/row sizes as text (`1fr 120 hug`, `auto` = 1fr), fill order,
and for grid children span and in-cell alignment. MCP: `set_auto_layout` /
`set_layout_item` take the new fields. Export and the GPU canvas draw the
boxes `withAutoLayout` computes (compose test + `canvas-grid-tracks.spec.ts`).

Discarded: one-item-per-cell displacement on drop, track drag handles on the
canvas (later).
