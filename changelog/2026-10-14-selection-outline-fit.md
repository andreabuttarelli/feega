# Selection outline sits on the element again

On the editor the selection box and the peers' outlines (`FramePeers`) were drawn offset, and
looked smaller than the element. Three causes, none of them the CSS zoom of `keepCrisp`:
`measureClips` returns fractions of `#root` inside the iframe, and they were verified exact at
every zoom and in WebKit.

- **The poster moved the picture.** `MotionPreview.still()` seeks the live player to 40% of the
  video to shoot the poster (2.5 s after open and after every edit) and never seeked back. The
  timecode said 00:00, the picture showed 01:06, and the outline — computed for the editor's frame —
  sat where the element is at 00:00. `still()` now returns to `frame / fps` in a `finally`.
- **Nothing re-measured when the drawing changed by itself.** Boxes were read on `html`/`frame`
  changes plus 300 ms. A runtime that settles later (entrance states, fonts, the poster seek) left
  them stale. The measure script now watches `document.body` (MutationObserver + `loadingdone`) and
  posts `feega:redrawn` after 150 ms of quiet; its own measuring is forgotten via `takeRecords()`.
  `MotionPreview` counts them in `redraws`; `SelectionOverlay` and `FramePeers` re-measure on it.
- **`seek(NaN)` on every ready.** `keepCrisp`'s `const frame = el.iframeElement` shadowed the
  `frame` prop, so `driver.seek(frame / fps)` got an element. svelte-check had flagged it.

Stage resize and canvas zoom need no re-measure: the boxes are fractions and the SVG viewBox
scales with the stage. `selection-outline.spec.ts` checks it at full page, a narrower window, and
inline at canvas zoom 0.5/1/2 on Chromium and desktop WebKit; `frame-collab.spec.ts` checks the
peer outline's position. Discarded: measuring against the iframe's outer rect — the inner frame
already is the visible frame.
