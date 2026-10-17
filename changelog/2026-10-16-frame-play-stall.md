# Play no longer stalls on a frame being opened

Opening a frame without a poster schedules a poster capture. `still()` seeks
the player to the poster second, shoots, then seeks back. The Hyperframes
player's `seek()` sets itself paused without a `pause` event, so the editor
kept `playing = true` while the clock stood still: the playhead froze a few
frames in, or flicked between two frames. Inline on the canvas it hit on
almost every open; the full editor only when a capture overlapped playback.

`previewDriver.seek` now re-applies the wanted playback after seeking.
Captures use a private `place` (seek without resuming), so a shot is never
taken from a running clock; the seek back that ends a still resumes play.

Discarded: skipping the poster while playing (two places to keep in sync),
and listening for a pause the player never emits.

Test: `tests/e2e/canvas-inline-play.spec.ts` (inline and full route, Play
button and Space), unit test in `preview-driver.test.ts`.
