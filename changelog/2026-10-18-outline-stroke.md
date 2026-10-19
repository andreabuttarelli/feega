# Outline stroke

⌥⌘O (Layer menu: Outline stroke) turns the first visible stroke of each
selected shape into a filled path that looks the same: the outline is offset by
the stroke weight (clipper's offset, behind `offsetPolygons` in
`polygon-clip.ts`, the only file that knows its format), inside/centre/outside
from the stroke's align (`REACH`), joins and caps carried over, holes even-odd.

A stroke-only shape is replaced in place. A shape with a fill keeps the fill and
its stroke goes on a new track just above it, so the two stay separately
editable; a frame already at the track cap is refused rather than reshuffled.
Curves become polylines, as with the booleans.

Agent: `combine_shapes` op `outline_stroke`. No new tool name.
