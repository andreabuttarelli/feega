# Frame tiles never go blank around the inline editor

Two holes, both found by the release gate.

**Reselecting an element showed a skeleton.** 77e2694ae unmounted a tile's
own player whenever the inline editor owned it, overriding the `LAYERS`
table in `inline-motion.ts`. A free element has no poster, so between the
click and the editor's first frame the tile was empty (~300 ms). The
override is gone: the table again keeps the tile's player until the editor
has painted (`Paint.Swapped`), then drops it. A brief second player is the
accepted cost; `gpu-canvas.spec.ts` now asserts one player once the editor
has painted.

**Leaving a poster for another frame flashed black.** Two causes:
- The leaving tile re-offers its body to the stage (the host element is
  re-created). `offer` reset `paint` to Pending and hid the editor stage.
  The cleanup could not tell, because an effect teardown reads `leaving`
  as it was before the change. `inline-stage` now tracks the leaving node in
  a plain variable, and a handed-back offer keeps its paint.
- `painted` trusted `decodedPoster`, which starts out as the poster URL
  without decoding it. The tile released the editor before its `<img>` had
  loaded. `painted` now waits for the image's `load`.

Kept out: starting `decodedPoster` at null. It hides a stored poster on
first mount, and two render tests break.
