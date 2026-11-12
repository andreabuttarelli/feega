# Canvas: opacity, hide and move patch the shown frame before the rebuild

After #2080 the rebuild started at once, but an element edit still waited for the worker to
rebuild the whole frame (~100 ms) and for ~80 ms of main-thread work.

- `fastPatch` (`src/lib/canvas/core/fast-patch.ts`): when the edit touches one layer's opacity,
  `hidden`, or `transform.x/y`, the last built display list is patched (opacity ratio, items
  dropped, matrix shifted) and shown under a new live generation; the worker build lands after it
  and replaces it. Bails out to the full build when an auto-layout parent would reflow, an
  ancestor rotates/scales or animates, an item is masked or scissored, or opacity was 0. Tests
  compare the patch with `drawFrame` of the edited doc.
- The local draft of unsaved ops is diffed 50 ms after the edit, not inside it.
- `withAutoLayout` is memoized per doc and text measure, so selection, guides and tools share one
  layout per edit.
- The text probe presses keys on the caret field itself.

Landings, perf:budget p50 (8 edits/kind): nudge 142–203 → 78 ms, resize 104–137 → 73,
opacity 180–196 → 113, hide 182–191 → 87. p95 is still 150–280 ms; the gate (16.7 ms) fails.
Heavy did not run: the probe's login never left `/login`. Typing still produces no `input` event.
