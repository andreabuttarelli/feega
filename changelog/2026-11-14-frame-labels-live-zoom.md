# Frame labels follow the camera during zoom

Frame name labels are overlay paths whose size and truncation come from the zoom step. `paintOn`
in `CoreFrames.svelte` sent overlay parts only when the camera was still, so during a zoom the
labels kept the size of the last settled step and jumped at the end.

- `SentParts.changed` now takes the motion: while the camera moves it sends `fixed` and
  `selected` (where the chrome with the labels lives); `live` (guides, marquee, peers) still waits
  for stillness.
- The step is quantized (8 per octave), so rebuilds happen once per step, not per frame.
- Checked on `landings-wall.feega`: ~61 fps through a zoom, labels readable mid-gesture.
