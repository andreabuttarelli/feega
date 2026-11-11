# Perf: a tile plans only the uses it shows

`World::scene` (every tile batch and rest block) and `World::screen` (every retained region) cloned
every use in the document into a display list, so each raster cost grew with the canvas. Patches
searched the use list by clip, `touch` scanned it by group, a restack was quadratic, and `holding`,
`lifts` and `extent` walked every use each frame.

Uses now live in slots keyed by clip and group (`src/uses.rs`), with a uniform grid of their world
bounds (2048-unit cells; a use spanning more than 256 cells, or with no known size, is a candidate
everywhere). The grid is maintained on put, drop, restack and `touch` (group resize). A plan for a
rect walks the uses meeting it, in stored z-order; `screen` also keeps cached and held uses, whose
off-screen cache bookkeeping the plan still does. The extent is cached and rescanned only when a use
on its border leaves or shrinks.

Why a grid and not an R-tree: world uses are frames — large rectangles on a sparse layout, with the
small dense nodes inside their groups, not in the world. Cells near frame size give one to a few
cells per use and per tile; no crate needed. A query covering more cells than are occupied walks the
occupied cells instead, so zooming far out costs what the visible set costs.

Culling stays at the frame rect, which is exact: every placed item is scissored to its frame, so
blur, shadow, backdrop and feathered masks never paint outside it. `tests/world_index.rs` checks
plans built from the index against plans of every use (seeded worlds, both cast paths, tile and
screen plans), the incremental index against a model, effect-heavy frames at tile edges, and that a
tile visits as many uses in a 100k-use world as in a 10k one.

Measured with `examples/world_visits.rs` (6 tiles of 1024 px, 2880×1800 viewport): uses visited
per frame on the scaled landings canvas went from 72 / 252 / 468 (10k / 50k / 100k nodes) to 2–6 at
every size; on a synthetic grid of 10k / 100k frames from 60,000 / 600,000 to 8–60, and the list
build from 11–22 ms / 104–124 ms to 1–10 µs.

Known gap: a group's dropped size is not refreshed (`drop_group` touches only before dropping), so
a use of a dropped group keeps its old bounds; it only changes which plans report it missing.
