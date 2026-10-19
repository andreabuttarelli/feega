# The right bar paints its own background

**Why.** Since the bar became one instance moved between slots (#831), its background came from
the slot: the canvas pane painted `--ui-wash`, the editor's side column paints nothing. In the
editor the bar (chat, guide, properties) was transparent over the stage.

**What.** `.right-bar` in `RightBar.svelte` sets `background: var(--ui-wash)`, so it looks the
same in every slot, light and dark. The phone canvas chat now uses wash too, not panel.

**Handoff.** Clicking a frame also hid the bar for ~0.5 s: the layout closed the canvas pane on
`inlineStage.editing` (releasing its claim) while the editor's `BarSlot` sat behind
`panelsDue`, so the bar went back to the offscreen park until the stage showed. Now the canvas
pane stays mounted and stows (`display: none`) only when its `BarSlot` reports `held = false`,
i.e. once the editor has claimed; the editor claims on mount. Discarded: a fixed shell-level bar
that never moves (bigger refactor of both layouts; the claim order gives the same guarantee).

**Tests.** `right-bar-paint.test.ts` (compiled CSS); e2e `right-bar-persists.spec.ts` compares
the computed background on canvas and editor, light and dark (`@real`); `right-bar-handoff.test.ts`; e2e samples every frame from the click to the timeline
(same node, on screen, opaque, scroll kept, stream uninterrupted).
