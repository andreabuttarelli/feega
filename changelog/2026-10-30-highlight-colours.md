# Highlight colours: blue, components purple

Hover and selection used three unrelated colours: violet hover (`--ui-hover-outline`, a
hard-coded `#b14cff` in the GPU painter), accent selection boxes, and node rings tinted by
output type. Now one table, `HIGHLIGHT` in `src/lib/canvas/highlight.ts`, maps a kind to a
colour: elements (frame, stack, group, text, shape, free element) and canvas nodes are blue
(`--ui-highlight`), components, main or instance, purple (`--ui-highlight-component`, the
`#9747ff` already used by the component drop target and the instance inspector). A test keeps
`app.css` tokens equal to the table.

- Canvas: `pickHover` and `FrameSelection` take their colour from `highlightOf(doc, clip)`;
  breakpoint views share `marksIn`, so they follow.
- Layers: rows carry `--highlight` from `rowHighlight`; instance rows get purple icon, name,
  hover outline and selection wash.
- Node rings: always blue (`ringColour()`); the output-type tint is gone.

Also: Go to main component is in every menu for an instance. Layers right-click, the right-bar
header "More actions" and the selection toolbar "…" were missing (`go-to-main-surfaces.test.ts`).
`mainClipOf` now finds a main nested inside a group (imported components), returning the group
clip that holds it.
