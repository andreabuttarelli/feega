# A free Stack resizes and rotates as one box

Defects (production), on a free Stack element (`FrameKind.Element`, root clip a Stack):

- **Resize split the box in two.** `fitElementToNode` scaled every clip with the node
  (`Scale` constraints) while the Stack kept hugging, so the node took the dragged size and the
  Stack stayed where layout put it: two boxes. Now `stackElementResized` (`layout/stack-fit.ts`)
  takes that path for a single Stack root: on each dragged axis Hug becomes Fixed (Fill and Fixed
  stay) and the Stack fills the stage; children keep their pixel size and the Stack lays them
  out. Client (`+page.svelte` → `frameDocs.edit`) and server (`sizeFrame`, now asked with
  `ResizeMode.Element` for elements) run the same function.
- **Text stretched during the drag.** The resized node's texture was held and stretched until
  pointerup (the 2026-10-20 resize fast path), and the GPU canvas ignored the live doc preview
  (`videoSide.preview` was a no-op). The chrome table now declares `resize: ResizePaint` per
  frame kind: elements are `Relaid` — `frameDocs.preview` swaps the live doc each frame and the
  core re-rasters it — frames and groups stay `Held` (landing-size frames keep the fast path).
- **Rotate 90° cropped the content.** The inspector turned the root clip inside the element doc,
  so the content rotated inside the unrotated node and was clipped by it. After an edit,
  `elementTurn` (`motion/element-turn.ts`) moves a static turn of the single root clip to the
  node rotation; animated turns (keyframes) stay in the doc.

Left: the inspector rotation field still reads the clip's rotation (0) rather than the node's;
an agent turning the root clip through MCP still turns it inside the doc.

Guards: `stack-fit.test.ts` (taller/wider drag → Fixed, node box = Stack box, children keep
pixels; a child added grows the node), `element-turn.test.ts`.
