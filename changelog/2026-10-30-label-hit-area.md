# Frame and node labels are hit where they are drawn

After #1633 labels scale with zoom, but the hit area stayed a fixed 24 world-unit band over the
whole width of the tile. Zoomed out the band was smaller than the label (a click on the text
missed); zoomed in it was a full-width strip far taller than the text.

## What changed

- `labelBoxes` (`core/chrome.ts`) returns the visible boxes of a tile: icon plus truncated text,
  and the tag dot. `label()` and `labelBoxes` share `labelLayout`, so drawing and hitting cannot
  drift. Hidden labels (frame under `LABEL_HIDE_FRAME_PX` on screen) have no box.
- `nodeHitRects` (`core/node-hit.ts`) = tile body + label boxes. `GpuFlow` builds `hitIndex` from
  it (click, drag, hover, context all go through `topNodeAt`) and `titledAt` (rename on double
  click) from the label boxes only. `LABEL_CLEARANCE` stays only for the selection overlay and
  the rename input position.
- Applies to frames and generative nodes alike: they draw the same chrome.

## Tests

`node-hit.test.ts` at 10/25/50/100/200 percent: inside selects, one pixel outside does not,
narrow frames have no box. `canvas-label-hit.spec.ts` (@real) drags the label and a point just
above it in a browser.
