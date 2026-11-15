# Canvas: redraw budget retries; edits after a reload patch

- `PatchBudget`: a layer drops to the worker only after two slow patches in a row (the first is
  often only the cold layout), and gets another try after eight edits on the worker.
- The first colour edit after selecting a layer went to the worker: logging the declines showed
  the session doc had been replaced by a reloaded copy (every clip and field a new object, keys
  `tracks`, `comps`, `assets`, … all different), so `onlyClip` matched nothing against the shown
  doc. `relinked(before, after)` swaps every clip and field equal by value for the shown doc's
  object; `reloaded()` (first and last clip both new, same count) gates it so normal edits pay
  nothing. Breakpoint view frames are skipped: their docs are regenerated on every edit.
- Profile of resize (`BUDGET_PROFILE=1`, `profile-windows.mjs`): besides layout, the overlay's
  `FramePlacements.#wordsOf` walked every track to find each placed clip. Clips are now indexed
  once per placements object.
- The resize "pixel" samples include the probe's own `getImageData` (~3 ms/edit in the profile).
