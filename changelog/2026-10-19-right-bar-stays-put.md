# The right bar stays put when a frame opens on the canvas

**Why.** #870 kept the canvas pane until the editor claimed the bar, but the e2e frame sampler
still caught one frame with the bar at 0×0 and scroll reset. The editor on the canvas measures
its host, which is narrower while the canvas pane is open, so for a frame it is "tablet": its chat
column is `display: none`, and the bar had already moved there.

**What.** On a desktop canvas the bar does not move at all. The canvas pane stays open while a
frame is edited (`open={chatOpen || inlineStage.editing}`), and the editor's `BarSlot` takes
`seat={BarSeat.InPlace}`: it claims with no element, so the host's `holder` (the last claim with
an element) stays the canvas pane while `active` (the binding: context, Properties) is the
editor's. The editor hides its own side column in that case and always docks Properties into the
bar. The held/stowed handoff from #870 is gone. Standalone editor page and phone keep their own
slot.

**Discarded.** Gating the claim on the slot being rendered (ResizeObserver): the editor's
viewport flips for a frame, and the bar still lands in a hidden column before the observer runs.

**Tests.** `right-bar-host.test.ts` (in-place seat keeps the holder); `right-bar-persists.spec.ts`
5/5 on the real stack, plus `canvas-editor-transition`, `canvas-bar-centred`, `motion-editor`.
