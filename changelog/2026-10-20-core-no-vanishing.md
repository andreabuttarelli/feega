# Core canvas: a node is never left undrawn, and never drawn twice

**Vanishing.** `held` picked one layer per node by data readiness (real, previous, blocks,
placeholder), but `paint` drew only nodes whose group was already in the raster. A node coming
back into view had to be re-put, and puts are paused during a gesture, so it drew nothing until
the gesture ended. Found by recording, per paint, nodes that were drawn and then not, while on
screen (2 on a pan right after load, 0 after). Now each node has a chain of layers; `firstDrawn`
draws the best one already in the raster, and the last one (shared placeholder, cheap) is put
even mid-gesture.

**Two copies.** A frame the live editor shows (`handedOver`) was still drawn by the core.
`CoreFrames` takes `hidden` and leaves those ids out of the uses it sends; they come back when
the editor hands over.

**Overlay.** `SentOverlay.waiting` lets the overlay (screen-constant strokes, rebuilt with every
zoom step) wait for the gesture to end instead of being serialised to the core every frame.
