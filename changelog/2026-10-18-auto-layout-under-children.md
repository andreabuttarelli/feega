# Auto layout container sits under its children

`wrapInAutoLayout` put the container on a new track below the lowest child's
track. Clips added through the API land on one shared track, so a full-frame
background sharing that track ended up above the container and hid its fill.

Now each child sharing a track with other clips first gets its own track,
directly above the old one, top-most child first so their order holds; the
container track goes right under the lowest child. Isolated tracks are named
`<trackId>-<clipId>` to avoid widening the op's signature.

`add_auto_layout` also takes `fill`, `stroke`, `stroke_width` (px) and `radius`
(Shape roundness), applied to the container in the same call.
