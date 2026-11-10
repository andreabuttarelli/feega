# Canvas: names and selection rings re-sent on every zoom step

The core overlay (node names, selection rings) was sent only once a gesture went quiet, so during a
zoom the retained screen or the tiles scaled the labels and rings drawn at the zoom the gesture
started: stale "Frame" labels at several sizes. `CoreFrames.svelte` now sends the changed overlay
parts every frame; `SentParts` already sends only the parts that changed.

Landings, CPU 1x, 2 runs, fps / p95 ms: tiles off zoom 31–32 / 100 → 26–30 / 117, fit unchanged
in one run, 32 / 67 in the other; tiles on unchanged (zoom 58–59 / 18.2).
