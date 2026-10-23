# Frame titles and picking on the core canvas

- Title: the label clipped itself with a `scissor` in world coordinates, but the raster scissors in
  framebuffer pixels, so only the icon survived. `chrome.ts` now truncates the text with an
  ellipsis to the room after the icon and sets no scissor.
- Picking: a clip with an effect compiles to an `Html` layer with a full-frame quad, which the
  picker skipped. `compileScene` now keeps the real geometry of its native parts (`bounds`);
  `placedAt` yields them and `pickable` accepts an `Html` layer that has bounds.
- e2e: `canvas-frame-titles.spec.ts` (red before, green after). The `frame-selection` test id was
  never removed; `canvas-element-paste` passes unchanged on current dev (it failed only on a
  duplicate `css` import, fixed in #1173).
