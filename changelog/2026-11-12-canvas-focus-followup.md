# Canvas focus follow-up to #2097

**Before.** #2097 made canvas shortcuts act only with focus on the canvas. A pointer click on
a toolbar button kept focus there, so V/R/T, arrows, Delete and Escape did nothing until the
next canvas press. `FrameTimeline`, `MotionTimeline`, `GraphEditor`, `CursorChat`, `FrameTools`
and the pen/vector/shape-builder/draw overlays listened on `window` ignoring the region. The
canvas context menu and the add-bar insert menu closed on a plain window Escape, which also
reached the canvas and dropped the selection. bits-ui Popover was not on the Escape stack.

**Now.** `key-region.svelte.ts` keeps one table, `REACH`, with three columns per region:
canvas commands, timeline keys, pointer focus.

| Region | Where | Canvas | Timeline | After a pointer click |
|---|---|---|---|---|
| canvas | nothing focused, canvas surface | every key | yes | keeps |
| layers | layers list, frame timeline | selection keys | yes | keeps |
| commands | add bar, selection toolbar, top bar | undo/redo | no | focus back to canvas |
| panel | inspector, popovers, dialogs, chat | undo/redo | no | keeps |

`releaseFocus` (window click capture) blurs a command control after a pointer click
(`detail > 0`), never after Enter/Space (`detail === 0`) and never a text field. Window
listeners acting on the canvas gate on `keyOnCanvas`; timeline ones on `reachesTimeline`.
The context menu and insert menu use `openLayer`; Popover content registers as
`Closes.ItsOwner` like the dropdown wrapper.

**Discarded.** `preventDefault` on mousedown for toolbar buttons: kills focus for keyboard
users too and breaks bits-ui triggers. A per-component blur in each toolbar: the rule would
live in five places.

**Left global, on purpose.** Command palette / node search (⌘K-type openers), page zoom,
Alt+digit panel shortcuts, modal overlays' own Escape (OutputViewer, CompareOverlay,
CloudPicker, PrototypePlayer, ComponentLibrary, HowFeegaWorks), docs search. Native `<select>`
already behaves: its Escape is handled by the browser and its region is panel.
