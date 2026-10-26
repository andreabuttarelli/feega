# Core canvas: level of detail by zoom

One rule table, `packages/gpu-core/src/lod.rs`:

| on-screen extent | draw |
|---|---|
| under 0.5 px | skipped |
| under 1.5 px, uniform solid ink covering 30 % of its box or more | one bar (text-like) at 55 % of the coverage |
| otherwise | full vector |

Blur under 0.5 px on screen is dropped (the item becomes a plain path, no layer pass).

How it applies. The cached encoding of a group (previous change) is now a list of runs: consecutive
items, up to 16, of the same size tier (log2 steps of 4x), each with its own `Scene`, bounds, extent
and ink. Order is kept, so z-order cannot change. Each frame a run is dropped if its screen bounds
miss the viewport, skipped or turned into a bar by the table above, or appended otherwise. Groups
that cannot be cached (layers, pictures, text) are filtered in the plan instead: items outside the
viewport or under half a pixel are dropped and tiny blurs removed.

There was no spatial index: `World` keeps a flat list of uses and damage is a rect list. The
viewport test per run is the culling; a tree was not added because a run is already the unit and a
group is culled whole first.

Native bench, 120 groups x 150 text-like paths (4.5 x 7 px), zoom 0.02 to 0.29 over 90 frames:
p50 21.6 -> 1.45 ms, p95 61.5 -> 2.0 ms (versus the encoding cache alone). With 27 x 40 px
elements at the same zoom the gain is within noise: 21.3 -> 21.3 ms p50.
