# Vanishing-cut guard

The intro video blinked out at 8.0 s: a custom component faded its dot grid
from opacity 0 right after a cut, so the canvas vanished for ~1.3 s.

Measured the app paths first: a composition is one document with every clip
mounted up front, so browser export showed no blank frame at any of 14 clip
boundaries (2100 frames, ffmpeg). The defect was authored, not rendered.

- `cutProbeTimes` samples the last frame before each scene cut and five
  frames over the 1.2 s after it (max 8 cuts).
- `vanishes` flags `vanishing-cut` (blocking) when the picture's luma std
  halves across adjacent frames and returns to 80% within 1.5 s. A cut to a
  title card that stays is not flagged.
- `view_frames` runs the probe and adds the problems to the gate.
- `write_component` guidance: first-frame content starts visible; scenes
  exit in 0.3–0.4 s.

Discarded: per-frame scan of the whole film (cost); mid-clip flashes are
still only caught on frames the agent views.
