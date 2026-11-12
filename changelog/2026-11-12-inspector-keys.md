# Editor: canvas keys stay on the canvas, Escape closes one popup

The inspector audit (draft #2088) found canvas shortcuts firing with focus on an inspector button:
Backspace/Delete deleted the selected layer, Tab selected the next layer and dropped focus to the
page, letters switched tools. `key-region` already sketched the answer, but `keyRegion.follow()`
was never called, so `keyRegion.current` was always `canvas` and every key reached the canvas.
Text fields and selects escaped only because the shortcut matcher skips typing targets.

**The rule.** `regionOf(e.target)` decides per keydown: focus on nothing (body) or inside an element
marked `data-key-region="canvas"` (the canvas surface) is the canvas; an element under a declared
region takes that region; any other focused element is a **panel**. An unmarked new control is
therefore safe by default. `REACH` in `key-region.svelte.ts` is the one table of what each region
lets through:

| Region | Where | Canvas commands that act |
|---|---|---|
| canvas | nothing focused, the canvas surface, nodes on it | all |
| layers | layers panel, frame timeline | undo, redo, delete, delete-keep, deselect (Escape), select-all, duplicate, copy, paste, group, ungroup |
| panel | everything else: inspector, toolbars, popovers, menus, chat, dialogs | undo, redo |

A press on the canvas takes key focus back: `claimFocus` (window pointerdown, capture) blurs a
focused element outside the canvas. Without it the canvas grips, which cancel pointerdown, left
focus on the inspector button or layers row that held it, and the canvas keys stayed off.

Undo/redo stay global because they act on the document, not on the focused control, and a text
field still keeps its own undo (the matcher skips typing targets). The command palette (⌘K) and
page zoom have their own window listeners and were already global. The stateful `keyRegion` (last
pointer/focus) is deleted: it was dead code.

**Escape.** `ui/shell/dismiss.ts` keeps one stack of open popups and one window capture listener.
Escape closes only the top layer, stops the event (the canvas never sees it) and returns focus to
the element focused when the layer opened. SidePopover, ColorField's picker and BindChip register
with `dismissible(close)`; before, SidePopovers each listened in the capture phase, so one Escape
closed both levels of a nested popover, and BindChip let Escape through to the canvas, which
deselected the layer. bits-ui menus close themselves (their own escape layer and focus return) and
register as `Closes.ItsOwner`, so they still count as the top layer and nothing beneath closes.

Not changed: `FrameTimeline`'s own window shortcuts (loop in/out, RAM preview) still listen
regardless of region.
