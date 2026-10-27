# Image node drag

Dragging a Generate image node that held a result dragged the picture instead of moving the node.

Cause: the result `<img>` in `TieredImage.svelte` was natively draggable, so the browser started an image drag and swallowed the pointer gesture.

Fix: every `<img>` inside node cards (`TieredImage`, `GenNode`, `InfluencerNode`, `StudioBatchNode`, `SelectNode`, `OutputViewer`) is `draggable="false"`. `node-media-not-draggable.test.ts` guards them.

Social feed and products thumbnails were left alone: they have their own intentional drag-out.
