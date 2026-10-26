# Styles shared across the frames of a canvas

Named styles (`doc.styles` + `styleRef`) lived in one frame: a brand colour defined twice drifted.

- No new table: the canvas library is the union of the frames' styles, matched by name
  (`src/lib/motion/style-library.ts`, first definition wins when two frames disagree).
- Applying a library style a frame lacks copies it in, then links the element (`adoptStyle`).
  Editing a style rewrites it in every frame that has it (`syncedDoc`); frames without it are
  untouched.
- Canvas: the element Style select offers canvas styles (“· canvas”); with a frame selected,
  Properties lists the library and its colour swatches edit every frame. GpuFlow keeps the
  library (`style-library.svelte.ts`) from the drawn frames and pushes edits through each frame's
  session, so undo and realtime work as for any frame edit.
- MCP: canvas op `styles` {canvasId, name?, style?, ids?}: no style/ids lists, style defines
  everywhere, ids (`frameId:elementId`) applies. It is `Audience.Mcp`: the canvas chat prompt is
  at its 30k budget, and the chat already reaches each frame's `styles` tool. The motion tool
  `style_text_range` became `text_style` to win back prompt space.

Not done: renaming a style across frames, text styles edited from the library panel (MCP does).
