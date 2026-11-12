# A dragged element moves alone, at its place in the stack

On the tiled canvas (default since #1942) a dragged held use was drawn from **copies of the
screen tiles** under its rest bounds (`snapshot_lifts`, from dfc8d4c5f "Draw dragged frames from
their tiles"), shifted by the drag. Those copies held everything in that area: an element on top
travelled with the dragged one, the background came along, and when the tiles at the current
level were not there yet the dragged element vanished and only its selection ring moved. Off by
default it never showed; turning tiles on exposed it.

Now a moving held use is drawn **alone**, rastered in the overlay layer at the current camera
(from its cached group texture), never cut out of the tiles. When another use stacked above it
overlaps it, it stays in the tile scene at its z-order and the tiles under its old and new
bounds are re-rastered as it moves (`World::lifted` checks `Uses::over`). Snapshots are gone.

Guard: `npm run perf:free-drag` (red under grey, drag either one) and the `world.rs` lift tests.
Discarded: drawing the uses above the dragged one again over its layer; translucent ones would
blend twice.
