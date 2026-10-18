# Peers see the real node move, and rotate

#722 drew a ghost outline over a node that still sat at its old place, and
the node jumped when the commit arrived. Now the page shows
`withPeerMotion(tiles, peers, mySelection)`: tiles a peer is moving take
the peer's live box (x, y, w, h, rotation) before reaching the renderer,
so the real node moves in both DOM and GPU canvases with no renderer code.
After the drop the box lingers (`dropped`, until `landedAt` or
`SETTLE_MS`), so the node stays put until the committed row says the same
thing: no jump back. Tiles I am moving myself are never overridden.

Rotation: the rotate handle now reports the angle on pointer move as a
live box with `r`; peers see the group turn while it is being rotated.
The local commit still happens on pointer-up.

e2e: the peer's node follows the drag (~490 ms from press including 20
pointer steps) and, sampled every 50 ms for 2 s after the drop, never
goes back towards its start.
