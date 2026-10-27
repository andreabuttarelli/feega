# Free images get an image output port

A free image element (one image outside any frame, as a Figma import
leaves it) had no output: only `image` nodes did. `NODE_PORTS.element`
now declares an `OutputRule.FreeImage` output, resolved by
`portsOf` from `holdsImage`, so the port table stays the one place where
ports per node type live. `freeImageAssetId` reads the one image clip of
the element's doc; `imageSourceTile` (GpuFlow) applies it to the tile.

`graph.ts` gets an `element` kind: medium image, not generated, so it
is a source and never a target.

Server: `upstream.ts` resolves an element that feeds something through
its head revision to the asset, and `generate` signs the storage path
like any upload. `connect_nodes` and the canvas `connect` action refuse
an element without a single image (`elementSourceRefusal`).

Image layers inside a frame are not nodes and `nodes_connections`
points at nodes, so they stay out: a column for clip ids is not cheap.

Discarded: caching `imageAssetId` in `nodes.data` (a second copy to keep
in step with every write path of the doc).

`drag-out-feed-images` had no commits when this landed; the nodes it
creates are `image` nodes, which already carry the port.

Demo recorder: `FEEGA_VIDEOS_DIR` overrides the output root.
