# Tab / ⇧Tab siblings, Enter into a frame from the canvas

Expected keys: Enter one level down, ⇧Enter parent, Tab / ⇧Tab siblings.
Enter/⇧Enter already worked inside an open frame; missing were Tab and Enter on the canvas.

- Frame: Tab / ⇧Tab → `Command.SelectNext/SelectPrevious` → `siblingOf(layerOrder(doc))`
  (`motion/siblings.ts`), front-first like the hit stack, wrapping. Top-level layers only.
- Canvas: Enter on one selected frame tile → `enterFrame` (`canvas/enter-frame.ts`) opens it
  and asks the drill with `from: Depth.Frame` and no point, so the first layer is selected.
  `DrillAsk` now carries `from` and a nullable `at`. Tab / ⇧Tab walk the tiles.
- View-only: no parity tool. GPU renderer: add `enter`, `select-next`, `select-previous` to
  `GpuFlow`'s key table using `enterFrame` and `siblingOf`.
