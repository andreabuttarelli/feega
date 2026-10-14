# A frame the agent creates lands beside its nodes, on free canvas

`startMotion` placed a new frame "to the right of the nodes in `near`" from `size.width`, which
is null for any node created at its default size (docs, image nodes made by the agent). On the
demo brief the teaser frame landed on top of the campaign brief doc. It now reads each node's
real rect (stored size or the type's default from `nodeSize`) and uses `placeBeside` with every
node on the canvas as occupied, the same rule the canvas uses for a node born from another.
