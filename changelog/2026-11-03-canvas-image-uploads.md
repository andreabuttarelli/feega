# Canvas pictures: decoded off the main thread, uploaded in bands

Follow-up to `2026-11-03-canvas-paint-deltas.md`, which left image uploads as they were.

- **Measured first.** In Chromium, `copyExternalImageToTexture` from an `HTMLImageElement` costs
  20–130 ms of main thread for a 12 MP photo; from an `ImageBitmap` 1–5 ms whole, 0.2–0.4 ms per
  375-row band. `createImageBitmap(img, { resize… })` blocks the main thread ~17 ms synchronously;
  `createImageBitmap(blob)` returns in 0.1 ms and decodes on a worker thread.
- **Stills decode from their bytes.** `media.ts` fetches a still and decodes it with
  `createImageBitmap(blob)`; an SVG (which `createImageBitmap` refuses) or a failed fetch falls back
  to the image element. The WebGL `raster.ts` caches bitmap textures as it cached image ones.
- **Bands across frames.** gpu-core `picture_rows(clip, source, w, h, top, rows)` copies rows from a
  source origin into a staging texture and swaps it in with the last band, so a half-sent picture
  never shows and an old one stays until the new one is whole. `core-web` sends at most 2 MP per
  upload slot, and sends a bitmap already at its fitted size as it is, without the
  `createImageBitmap` copy. Backends without `picture_rows` (WebGL, native) upload whole.
- **Home preload.** The home preloaded `/p/_/c/_/motion/_`, a page removed when the canvas became
  the editor; the dev client logged "did not match any routes". It preloads the canvas route.
- **Discarded.** Reusing the shown item objects of a live rebuild by deep compare, so `itemWire`
  hits its cache: on the landing fixture the compare costs what `JSON.stringify` costs
  (0.6–1.2 ms vs 0.7–1.7 ms for 39 items), so it saves nothing. Identity reuse inside `drawFrame`
  is not possible today: `preparedDoc` lays out and flattens components into new clip objects on
  every prepare.
- **#1789 "frames placed after surface" 165 → 653 ms at 4x.** Not a regression: in those runs the
  surface came ~1 s earlier and all frames were placed at the same absolute time or sooner
  (warm 4x: 5565 → 5052 ms to all placed). The difference is when the surface shows, not more work.
