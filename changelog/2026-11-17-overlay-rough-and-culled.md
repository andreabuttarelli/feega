# Canvas: the overlay is drawn at half resolution while zooming, and only where it shows

A 2200×1100 @2 profile (#2267) put the fixed overlay first in GPU cost: ~80k vello lines of
chrome and wires, redrawn on every zoom frame (pans were already held).

- `OverlayHold` now carries an `OverlayQuality`. A zooming camera draws the overlay at half
  resolution and the reprojector scales it up; at rest, or while a frame is lifted, it is
  redrawn sharp. The quality is part of what a held overlay must match.
- The pinned overlay (#2262) is split into one piece per owner (the clip prefix: a tile's chrome,
  a wire). Each frame appends only the pieces whose resolved bounds meet the held texture and are
  at least half a pixel on screen, so off-screen and sub-pixel chrome costs nothing.
- `PinnedScene::at` lerps into the scene it handed out last time instead of cloning a new one.

Supersedes #2265: #2267 already holds the overlay texture across pans and at a still camera.

Wide zoom (2200×1100 @2, uncapped, user canvas copy): p95 8.7–9.5 → 7.4–7.8 ms, frames over
8.3 ms 187–205 → 157–175; select-all p95 10.6–16.8 → 9.8–10.0 ms.
