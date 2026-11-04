# Fill colour popover closed on the first drag move

Dragging the saturation square, hue or alpha bar of a fill closed the popover on the first
pointer move; the shape changed, the fill row kept the old hex.

Cause: 71a86da3d bound `FillStack.open` to `frameProperties.editingFill` and reset it in
`FrameProperties.clear()`. The publish `$effect` in `GpuFlow.svelte` runs `clear()` as cleanup
and tracks the node list, placement and host, so every live colour write re-ran it and closed
the popover. #1808 (swatch keys) was unrelated.

Fix: `clear()` no longer touches `editingFill`; `publish()` resets it only when the node changes.

Guards: `frame-properties.test.ts` (republishing the same node keeps the fill open) and
`tests/e2e/fill-popover-drag.spec.ts` (real stack: the popover stays open through a drag, the hex
changes).
