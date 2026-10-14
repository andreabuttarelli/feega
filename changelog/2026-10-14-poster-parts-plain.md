# Poster parts: one selection level, no marker syntax, human names

**Before.** Picking a line inside an open frame left the canvas node selected too (ring + 8
resize handles) and the poster clip kept its scale handles: three selections at once. Properties
showed the whole `lines` textarea with `[photo]` and `->` markers; inline photos and the arrow
were not selectable; Layers said `Custom`, `lines 1`, and the header `TypeGridPoster`.

**Now.**
- `canvas/selection-chrome.ts`: one table, level → chrome. A node whose open frame has a pick
  shows a passive dashed ring and no `NodeResizer`; a clip whose part is picked shows a passive
  box and no handles (`clipChrome`, used by `SelectionOverlay`). Measurement untouched.
- `motion/poster-lines.ts`: structured view over the marker DSL. Storage stays the marker string
  (backward compatible, no migration); `editLines` keeps the media list in step when photos are
  added or removed, so later pictures keep their slot. `MARKED_POSTERS` lists the posters using
  markers: only `TypeGridPoster` among the poster templates and poster-kit.
- `poster-parts.ts`: `PartKind` + `PART_LOOK` table (label, icon). Marked lines read and write
  only their words. Photos (`photos:n`) and arrows (`arrow:i`) are tagged parts in the view;
  `PosterPartPanel` edits them (image pick, fit, focus; arrow toggle, `arrowColor`).
- `resolveMedia` keeps empty slots (`src: ''`) and passes `fit/focusX/focusY` through; every
  view already drops an empty `src`.
- Picking a clip row in Layers now clears the picked part (it stayed stuck before).

**Discarded.** Replacing storage with a JSON list: a schema change on saved docs and on the
agent's prop contract, for no user-visible gain.
