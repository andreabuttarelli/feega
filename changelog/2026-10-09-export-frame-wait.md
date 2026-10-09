# Browser export no longer times out on heavy frames in Safari

Node fd37d96f rev 22 (5 precomposed Shape3D asteroids, 8 grain filters, 2 particle
emitters, blurred shapes) failed "Export video" at frame 0 with "capture timed out".

Measured in WebKit 26.4 (Playwright), real path: `hyperframes-player` srcdoc, opaque
sandbox, `feega:capture` bitmap 1920×1080:

- 1 lane: ~9.5 s per frame. Chromium: 0.6–1.1 s, so Chrome users never saw it.
- 4 lanes (desktop `laneCount`): 27–32 s per shot. WebKit runs the lane iframes on one
  thread, so shots queue; each still had the fixed 15 s `CAPTURE_TIMEOUT_MS`. Frame 0 could
  never finish.
- Cost by bisection: grain (`noise`) ~5.6 s of the 9.5, particles ~1.9, base ~1.5.

Changes:

- `render()` gives every shot `CAPTURE_TIMEOUT_MS × lanes`: lanes share the thread, so the
  budget is per frame of work, not per shot. The timeout names the frame and the wait
  (`the frame at 0.00s did not draw within 60s`) instead of `capture timed out`.
- Grain computes `feTurbulence` on a 256 px stitched tile and `feTile`s it, instead of over
  the whole filter region: ~9.5 → ~7 s per frame in WebKit, same look.

Discarded: bounding the grain filter to the 3D canvas box (`userSpaceOnUse`, as Shape does).
Chromium draws it right; WebKit resolves user space against the painted content and drops
the asteroids — the apparent speedup was frames drawn empty.

Not a cause: precomp cycles/missing comps (rev 22 has none; `parseMotionDoc` already refuses
both at write time), particles prewarm (~1.8k particles, under the 4k cap), CSP, jsDelivr.

Still open: ~7 s/frame in Safari is ~55 min for 465 frames. The error does not name the
expensive clip: the capture runtime has no per-clip timing.
