# ⌥-letter align and Tidy up

Expected keys: ⌥A left, ⌥H horizontal centres, ⌥D right, ⌥W top,
⌥V vertical centres, ⌥S bottom. Tidy up: a row or column keeps its first layer and takes the
most common gap; a grid is laid from the top-left corner on both axes. The help page gives no
Tidy up shortcut: ⌃⌥T is unconfirmed, used as the sensible standard.

- `tidyMoves` (`motion/tidy.ts`) is the one geometry; `tidySpace` (frame, `space.ts`) and
  `tidyTiles` (canvas, `canvas/align.ts`) feed it. Ties on the common gap take the smaller.
- Frame: `Command.Align*`/`TidyUp` → `alignTo` / `tidySpace` through `apply` (save queue).
- Canvas: the matcher no longer drops every ⌥ key: ⌥ + physical letter (`e.code`) aligns,
  ⌃⌥T tidies; other ⌥ keys still pass through so typed characters are not eaten.
  Right-click gets "Tidy up" on both surfaces.
- MCP: `arrange_space` op `tidy`. GPU renderer: add `align`/`tidy` to its key table.
