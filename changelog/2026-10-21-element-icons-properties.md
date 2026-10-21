# Free element rows show their real icon; selecting one opens Properties

- The Layers tree drew every free element with one shape icon. The icon now follows the
  element's clip: `Shape` reads its `shape` prop, any other clip its component
  (`elementGlyph` in `layers.ts`, one table in `LayersPanel.svelte`). GpuFlow publishes the
  glyphs from the live docs via `layersSource.setGlyphs`.
- Selecting a freshly drawn element left the right bar on Chat: its `/source` fetch returned
  404 right after the draw and was never retried, so the own clip was never picked and no
  Properties session existed. `fetchPickDoc` now retries, and `ownClipToPick` picks the own
  clip once the doc is there (never again after the user deselects it).
- `canvas-free-insert.spec.ts` waited for `motion-editor`, which free elements no longer open.
  `pickRadio` in `canvas-bar.ts` now retries a lost click on the bar mode radio.
