# The right bar paints its own background

**Why.** Since the bar became one instance moved between slots (#831), its background came from
the slot: the canvas pane painted `--ui-wash`, the editor's side column paints nothing. In the
editor the bar (chat, guide, properties) was transparent over the stage.

**What.** `.right-bar` in `RightBar.svelte` sets `background: var(--ui-wash)`, so it looks the
same in every slot, light and dark. The phone canvas chat now uses wash too, not panel.

**Tests.** `right-bar-paint.test.ts` (compiled CSS); e2e `right-bar-persists.spec.ts` compares
the computed background on canvas and editor, light and dark (`@real`).
