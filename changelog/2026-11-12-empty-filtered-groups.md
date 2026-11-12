# Empty groups whose SVG effect cannot ink cost no layer

Zoomed far in on the landings fixture, every 256 px tile paid ~3 ms of CPU, ~85% of it in
`layers::prepare_items`: 28 offscreen paints for 9 layer-worthy items. Ten of those items were
groups whose children `Laying::lay` had already culled to the tile, left empty, still carrying an
effect filter (stroke, shadow: `feMorphology`/`feOffset` from `SourceAlpha`, a `feFlood` composited
`in` the result). An empty group has no bounds, so nothing culled it and its layer covered the
whole tile: body, mask and filter passes for transparent pixels.

`shades_nothing` already skipped empty groups with CSS filters. It now asks
`filters::paints_from_nothing`, which walks the SVG graph with one rule per primitive (`inked_by`):
blur, offset, morphology, tile, warp and displacement follow their input; `feComposite` follows
its operator (`in` needs both, `out` its first, `atop` its second, `arithmetic` may ink);
`feColorMatrix` inks only if it lifts alpha; anything unknown, `feFlood` on its own, turbulence,
lighting and component transfer may ink and keep the layer.

Far-in, per tile: 28 → 12 paints, 3.1 → 2.0 ms CPU. The rest of the far-in cost is scheduling
(one tile per gesture frame), the next change.
