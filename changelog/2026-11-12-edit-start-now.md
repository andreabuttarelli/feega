# Canvas: an element edit starts its rebuild at once

A CPU profile of a nudge on landings showed 70–125 ms of main thread between the key and the
live-frame rebuild starting: the rebuild waited for the Svelte effect flush, which first ran
the breakpoint views (13 ms), selection layout (12 ms), a hover re-pick of the unmoved pointer
(9–18 ms) and the save diff.

- `liveDocs.listen`: `CoreFrames` starts the worker build from inside `liveDocs.set`, so the
  worker runs while the main thread finishes the flush. The `$effect` stays for every other path.
- Breakpoint views read the live docs one idle callback late.
- A pointer move at the same spot (the browser re-sends one when the page changes under the
  cursor) re-picks the hover on idle.
- During a gesture, `stage` uploads the layer of the frame being edited instead of waiting for
  the gesture to end.

The perf:budget edit probe also times typing and can write per-edit CPU profiles.

Measured (landings, 6 edits per kind, noisy): input→rebuild start fell for nudge (102→5–53 ms)
and opacity (48→26–34); totals stayed 140–200 ms p50 because the whole-frame worker build
(~100 ms) and the main-thread work after it still sit on the path. Discarded: an engine-side
patch for opacity/hide/move this round; translation needs layout-aware deltas.
