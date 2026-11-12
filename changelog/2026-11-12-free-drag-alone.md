# A dragged element moves alone, at its place in the stack

On the tiled canvas (default since #1942) a dragged held use was drawn from **copies of the
screen tiles** under its rest bounds (`snapshot_lifts`, from dfc8d4c5f "Draw dragged frames from
their tiles"), shifted by the drag. Those copies held everything in that area: an element on top
travelled with the dragged one, the background came along, and when the tiles at the current
level were not there yet the dragged element vanished and only its selection ring moved.

Two more defects kept the old place on screen:

- `Tiles::frame` draws a sharper (or coarser) level when it covers the screen, but queued only
  the current level for raster. A changed tile at the level actually shown stayed stale for the
  whole gesture: the element left a ghost where it was, or did not move at all.
- `Compositor::stirred` took the world damage the tiled path reads, so the held full-screen
  picture under the tiles was never let go after an edit.

Now a moving held use is drawn from **its own tiles**: the use alone, rastered at its rest
position at the current tile step (`World::alone`, `raster_alone`), placed shifted by the drag
and blended over the scene. Uses stacked above it that overlap where it is or was are lifted the
same way, unmoved, and drawn over it in stacking order until the drag ends (`World::cover`).
Shown tiles at any level that are stale are queued again, and a change the tiles take forgets
the held picture.

Discarded: rastering the dragged use in the overlay from its cached texture (the PR's first
version). A texture is capped at 4096 px, so a landing frame dragged at 100% went blurry, and
keeping a covered use in the tiles meant re-rastering its old and new bounds on every move.

Guard: `npm run perf:free-drag`, the `world.rs` lift tests, `tiles.rs` stale-level and
lifted-keys tests, `compositor.rs` held-picture test, and the `world_index.rs` oracle (which now
models covering uses).
