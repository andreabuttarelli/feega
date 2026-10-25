# Empty canvas stays empty; colour fields read more formats

**Empty canvas.** The starting-point overlay (chat field plus three quick
actions) from 2026-10-14 is gone. Users found it in the way; the add bar
and chat already offer the same paths. Removed `EmptyCanvas.svelte`,
`$lib/canvas/empty-canvas.ts`, the `chatOpenRequest` effect in the project
layout and the `EMPTY_CANVAS` parity row.

**Colour input.** `parseColour` (`src/lib/motion/colour-field.ts`) is the
one parser for typed colours. It now returns `{ colour, alpha }` and reads,
through a table of readers: brand tokens; hex of 1, 2, 3, 4, 6 or 8 digits
with or without `#` (1 and 2 digits repeat to six, like `f` → `#ffffff`);
`rgb()`/`rgba()` and bare `r g b [a]` numbers, commas or spaces, alpha as
0–1 or %. Channels over 255 or alpha over 1 are refused, so the field keeps
its old value. `ColorField` passes the alpha to `onchange`; fill and stroke
apply it as opacity in the same write (two writes raced on stale props).
The brand wizard colour inputs normalise through the same parser.
