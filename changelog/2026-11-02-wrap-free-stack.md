# Wrap with stack on free elements keeps what it wraps

From the nesting audit (2026-11-02), all reproduced on production with the test account.

- **C1, hierarchy flattened.** `stackElements` lifted every clip of every source doc, children
  included, and wrapped them all. Now `placeAll` (`server/motion/element-groups.ts`) carries each
  source's visual tracks whole into the new doc: parents, `autoLayout.order`, gap and padding
  (rescaled to the new pixel density) come along, ids are renamed only on collision, and only the
  roots are wrapped. Grouping (`groupElements`) uses the same path.
- **C2, redo left a NULL-size row.** Redo of a `node.create` that only knew its position wrote
  `width/height = null` and `data = {}` through `restoreNode`. `restoreNode` now writes size and
  data only when the gesture carries them. Both `stackElements` and `groupElements` answer done
  without inserting when the client id already exists (a replayed request), instead of a 500 on
  `nodes_pkey`.
- **H7 / M3, clipped and shifted.** The stored stack props stayed at the pre-hug values (root
  `y: 1, h: 2` in an 80 px stage); a renderer reading them drew the children half outside.
  `laidOutAsShown` (`layout/stack-fit.ts`) bakes the laid-out geometry into the doc that is saved.
- **M4.** Direction and gap now come from `flowOf` (`layout/flow.ts`), shared by the doc wrap
  (`guessFlow`) and the client's optimistic tile, so both agree.
- **M2 / M10.** The optimistic Stack tile is a Stack element (not a Group with members), picked,
  also for a single element; the wrapped tiles stay drawn until the snapshot replaces them, so the
  stack never shows empty. Delete right after ⇧A queues behind the wrap and removes the stack.
- **H1, Hug stack in a frame.** A side drag hit the zero-padding handle that sat on the edge, and a
  corner drag wrote `scaleX/scaleY`. Padding bands now anchor to their own side and keep a 16 px
  minimum inward (`AutoLayoutOverlay.svelte`); scaling a stack goes through `sizeStackAround`
  (`layout/ops.ts`): new box, Hug → Fixed on the dragged axes, no transform scale.
- **H1, free stack.** `fitElementToNode` sized the stage with `customSize(node)` — one pixel per
  canvas unit — while element docs are drawn at two, so a resize doubled the children. The stage
  now keeps the doc's density from the node's previous size (`was`, client and `sizeFrame`).
- **Basics #16, Stack tool drew a grey rectangle.** The canvas draw layer turned the drawn clip back
  into a tool by component and shape, so a Stack clip (`Shape:rect`) became a Rectangle.
  `toolOf` (`canvas/canvas-draw.ts`) reads `autoLayout` first. The drawn Stack is Fixed at the
  drawn size (an empty Hug stack collapses to its padding) and its ghost is a dashed outline.
- **Basics #17** was already fixed on `dev` (`remove-layers.ts`); verified in the browser.

Not done: inspector numbers in doc pixels (M1), no feature video (bug fixes only).

Guards: `element-groups.route.test.ts` (nested stacks, gap 60, vertical, stagger, replayed id),
`undo.test.ts` (redo keeps size/data), `flow.test.ts`, `optimistic-registry.test.ts`,
`frame-transform.test.ts` (edge/corner on a Hug stack), `stack-fit.test.ts` (2× density resize),
`auto-layout-overlay-render.test.ts`, `canvas-draw.test.ts`, `draw-create.test.ts`,
`optimistic-insert.test.ts`.
