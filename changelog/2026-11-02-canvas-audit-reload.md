# Reload never shows an older frame; five inspector and selection fixes

From the canvas audit (2026-11-02, `~/Documents/feega-videos/audit/verify/`).

- **Reload showed an older frame.** Reproduced: after an MP4 export the frame card face drew the
  last render (`lastRenderAssetId`) until the GPU core built the doc, ~1.5–7 s after a reload. The
  render pictures the revision it was made from, which nothing records, so after further edits the
  frame flashed grey shapes and no text. `docFace` (`gpu/card-face.ts`) no longer draws the render,
  and draws the poster only when `posterFresh`. `posterFresh` now requires a recorded
  `posterRevision` ≥ `docHeadRevision`: an unversioned poster was trusted, now it is not (the DOM
  tile re-shoots one). The layers thumbnail (`frameLook`) uses the same check. The outbox, sent-op
  log and service worker were checked and are not a source: the service worker caches only the
  shell, and nothing stores frame docs locally.
- **Offline moves jumped after a reload.** Durability audit (`round2/durability/s2-reload-results.json`):
  for ~2.3 s after a reload the server's old positions showed, then nodes jumped once the outbox
  replay landed. `places.restore` only re-sent the entries; `placedRows` (`place-save.ts`) now
  applies them to the local rows (group moves carry their members) as soon as the outbox opens,
  and the dirty queues keep them over snapshots until they land.
- **X/Y rounded to whole pixels.** `PositionSection` rounded the shown value. `NumberField` takes
  `shows` (`FieldText.Step` default, `FieldText.Precise` up to two decimals, trailing zeros
  dropped); X and Y use it. Scrubbing still steps by whole pixels.
- **Line selection.** A straight line (open path, two corner points: `lineEnds`) draws no box,
  no resize or rotate handles (`SelectionKind.Line`), and `LineEndsOverlay` shows two endpoint
  handles; dragging one moves that end, Shift snaps to 45°.
- **Fill swatch read TRANSPARENT.** `solidName` labels a fully transparent solid `None`; every
  swatch sits on a checkerboard.
- **Gradient handles** show only while that fill's editor is open: `FillStack.open` is bindable,
  published as `frameProperties.editingFill`, and `gradientTarget` takes it.
- **Hover with a child selected.** The open frame rings on hover of its empty area
  (`emptyAreaRinged`); the chrome hover now draws over an editing ring, not only over none.
- **Insert menu cut a hole in the frame (v13).** Reproduced every time the menu opened over a
  frame: a strip of canvas background, menu-wide, from the frame top to the menu. Chromium paints
  an opaque scroller background into the scrolling contents layer and culls the GPU canvas under
  that layer's bounds (hiding the menu, `overflow: hidden` or a gradient background each removed
  it). The menu now keeps background and shadow on a non-scrolling box and scrolls an inner,
  transparent `.insert-scroll`. Lesson in `LESSONS.md`.
