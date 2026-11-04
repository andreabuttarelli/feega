# Free elements into frames from Layers, stack drop line, ⇧A on a drawn layer

Leftovers of the mobile case study (`~/Documents/feega-videos/audit/case-mobile/FINDINGS.md`, M8, M19).

- **Layers.** A free element row (a canvas node, kind element) was not draggable: only rows inside
  the open frame were. It now drags onto a frame row (lands inside, at the centre) or onto a layer
  of the open frame (above, below or into it, a stack included). `freeLanding`
  (`canvas/layers.ts`) is the one place that says which rows take it. The landing rides the
  existing `moveFree` op: the frame drop carries an optional `slot` (`motion/layer-place.ts`),
  and `planFree` places the root with `dropLayer` instead of the point-based `dropInStack`.
  Client plan and server move share it. `Place` moved to `motion/layer-place.ts` so the drop
  type can name it without a cycle (layers → stack-drag → move-element).
- **Canvas.** Dragging a free element over a frame only lit the frame. `stackLineAt`
  (`layout/stack-drag.ts`) gives the slot line of the stack under the pointer; GpuFlow draws it
  with `FrameGuides`, now also for a frame that is not entered.
- **⇧A.** A layer just drawn in a frame was picked (`drawnInside`) without moving the level onto
  it, so frame keys were skipped and the canvas command stacked the whole frame. The gate is now
  `picksOwnKeys`: any pick in the frame owns the frame keys.

Not verified in the browser: production Supabase was down during the work; queued.
