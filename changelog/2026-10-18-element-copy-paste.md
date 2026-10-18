# Copy and paste whole elements

In a frame ⌘C/⌘V only copied keyframes. Now ⌘C with no keyframes picked copies the selected
elements; ⌘V pastes the last thing copied (keyframes, elements, or canvas tiles).

- One clipboard for the page: `elementClipboard` (`canvas/element-clipboard.svelte.ts`) says what
  was copied last; it holds the elements as `Element`s (`copyElements`, built on `liftElement`
  without the removal), so a paste into any frame is a local doc edit through `apply` (save
  queue): `pasteElements` places each copy with a new id at the same relative place.
- Frame → canvas: ⌘V on the canvas posts `copyElement` (page action) → `copyElement` in
  `server/motion/move-element.ts` (moveElement without touching the source) → a new free
  element. MCP: canvas op `copy_frame_element`, same input as `move_frame_element`.
- e2e `canvas-element-paste.spec.ts` (@real, test account): copy inside a frame and onto the
  canvas.

Not yet: canvas free element → into a frame (needs the tile's doc on the client); next PR.
