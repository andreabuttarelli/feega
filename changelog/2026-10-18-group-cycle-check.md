# A node can no longer join a group it contains

`data.groupId` was written without checking ancestry: a write (canvas
page, API, MCP, an undo replay) could put group B inside A while A sat in
B, and layout code walking the chain would loop or drop both. Figma's
server rejects such reparents.

`patchNodeData` now refuses any patch that sets `groupId` to the node
itself or to one of its descendants (`nestsInItself`, walking the parent
chain with a seen-set so data already looped cannot hang it). It answers
`invalid` with "a node cannot join a group it contains", which every
writer already maps to a 400. One check, in the single function every
`groupId` write goes through.
