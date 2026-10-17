# Custom frame format: the node is the size

**Why.** A frame could only be a preset (16:9, 9:16, 4:5…). Resizing the node on the canvas kept
the preset's aspect, and any mismatch showed as letterbox bands.

**What.**
- `MotionFormat.Custom` (`'custom'`) plus `doc.freeSize`. `formatOf` returns Custom for a doc
  marked free or whose size matches no preset (it used to fall back to 16:9).
- `setCanvas` takes `size`; a preset clears `freeSize`, Custom keeps the current size. All sizes go
  through `fitsResolution` (the doc schema rule, now one function).
- `customSize` (`src/lib/motion/custom-size.ts`) maps the node picture to pixels: long side up to
  1920, short side up to 1080, even sides.
- Canvas: `frameResize` (`motion-node.ts`) decides per sizing — preset keeps aspect, Custom keeps
  both sides and returns the picture. Open frame → `layersSource.video.edit` (undoable, saved by
  the editor); closed → `?/frameSize` → `sizeFrame` writes a revision and returns a
  `doc.revision` undo item.
- Properties: Custom option shows the doc size; W × H inputs (typing a size makes the frame Custom).
- Agent: `set_canvas` accepts `width`/`height`; `get_motion_doc` reports `format`. Parity table
  rows for `frameSize` and the custom size.

**Fixes found on the way.**
- `syncNodes` kept the `width`/`height` the resize handle wrote on the Svelte Flow node, so a new
  tile height (e.g. the bar coming back when the inline editor closes) never applied.
- The node poster uses `object-fit: cover`: a poster captured before the resize landed showed bands.

**Not done.** The frame templates picker keeps its preset formats (templates are designed per
preset). Undo of a canvas resize restores the doc size, not the node size.
