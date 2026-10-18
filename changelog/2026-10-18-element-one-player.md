# A free element runs one player while edited

`Under.Kept` kept a free element's tile player mounted under the inline
editor, so that closing the editor reloaded nothing. The one-off override
from 77e2694ae had made it dead code. Once #830 removed that override, every
edited element ran two players, and `canvas-free-text.spec.ts` typed into the
hidden tile iframe, the first one in the DOM, instead of the editor's.

Per the decision on #830, the tile keeps its player until the editor has
painted, then drops it, for every kind. `Under` is removed.
`canvas-edits-kept` "stays red" passed 8/8 with this change, against 5/8 on
dev with the player kept.
