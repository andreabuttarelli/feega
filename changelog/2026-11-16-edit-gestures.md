# Canvas: resizing and dragging frames stop rewriting styles

Resizing a real-site frame ran at 0.5–1.3 fps with 7–22 s frames. The CPU profile was 80–88%
inside the style library reconcile effect (`GpuFlow.svelte`, `styleLibrary.found`): it compares
every frame's text styles in canvas pixels (`scaleOf(doc, box)`), and during a resize the box moves
on each pointer event while the previewed doc follows a frame later. Every style read as changed,
`found` pushed the library value back, and `syncStyle` committed `Updated the X style` to the frame
on each step — a history entry, a save and a poster rescan of the whole page each time. Cmd+Z after
a resize undid a style instead of the size.

- The style and variable reconcile wait for the gesture to end (`overrides`/`resizing` empty).
- `fitToNode` holds `doc.styles` text sizes at their pixels, as it already did for text clips;
  without it the settled reconcile rewrote every text style of the resized frame once it landed.
- `reverseResize` starts the box restore before the doc step back, so undo never shows the old doc
  in the new box (which pushed a style once more).
- `placedTiles` keeps untouched tiles the same object during a drag; `sceneStamp` reads a doc's
  scenes once per doc; the pixel grid measures itself only when it is on.

Landings fixture, production build, drag of a site frame: Svelte flush 38% → 26% of the main
thread; resize: flush 88% → 17%, sampled time for a 6 s gesture 15.4 s → 7.5 s.

Not done: the resize preview still re-fits the whole doc (`fitToNode` + `heldPixels`, ~15%) and
CoreFrames rescans the poster frame of each preview doc (~13%) per frame on long pages; the
engine is the rest. `FramePeers` reads `getBoundingClientRect` on every pointer move (~3%).
