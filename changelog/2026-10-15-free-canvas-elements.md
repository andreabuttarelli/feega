# Free canvas elements: a chromeless frame

Graphic elements could only be drawn inside an open frame. Now the draw tools sit in the canvas
bar while browsing too (`BAR_SLOTS`), and a shape drawn on the empty canvas becomes a frame node
with `data.kind: 'element'`: a transparent still doc sized to the drawn box, its one clip filling
it.

Path: draw on `CanvasDrawLayer` (reuses `DrawOverlay` over a scratch doc the size of the pane) →
`drawnOnCanvas` turns the clip into canvas units → page action `drawElement` → `drawElement` in
`server/motion/move-element.ts` builds the doc (`drawnElement`) and creates the node through the
`FrameStore` → `nodes` + `motion_revisions`. Undo is the `node.create` item the action returns.

`frameChrome(kind)` is the one table of what differs: no play bar, Open editor, name tag or
ports for an element; PNG poster (transparent) instead of JPEG. Posters now accept PNG
(`savePoster`), and transparent frames poster as PNG from the editor too (`posterFormat`). An
element opens with its clips selected and Properties showing (`openingSelection`).

ADR 0011 rewritten: the first draft's `element` node type was dropped for the chromeless frame,
which reuses renderer, inspector, `moveElement`, realtime and LOD and needs no migration.
MCP: canvas op `draw_element`, parity row `drawElement`.

Not here yet: canvas shortcuts for the draw tools (⇧T/⇧R… work only inside a frame), drag out
of/into frames as free elements, groups.
