# Boolean operations on shapes

`combineShapes` flattens each Shape outline into frame space (`pathSpace`),
runs the polygon clip through clipper-lib (`polygon-clip.ts`, the only file that
knows its format), and writes the result as a path on the bottom shape, in its own
local space, so style and transform stay; the other shapes are removed.

Destructive on purpose: a live boolean group would need a new clip kind rendered
on every engine. Curves become polylines (16 samples per segment). Commands in the
Layer menu and ⌥⇧U/S/I/E; agent parity `combine_shapes`.
