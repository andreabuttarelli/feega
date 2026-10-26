# Remove the DOM inline frame editor from the canvas

Step 10 of the canvas/editor unification. The GPU canvas edits frames directly (unified frames,
default on), so the old DOM path is gone:

- `InlineMotionEditor.svelte`, `inline-stage.svelte.ts`, `claim-width.ts` and the warm/prefetch
  modules that only fed it (`warm-frames`, `early-fetch`, `reopen-session`, `open-timing`).
- The paint swap (`Paint`, `nodeLayers`, `ownPlayer`, `tileMode`, `inlineMotionTarget`…) in
  `inline-motion.ts` and `MotionNode.svelte`; the `?unifiedFrames=0` fallback.
- The page's host drag/turn/fit and move-out plumbing that only the inline editor called.
- E2E specs that only exercised the inline editor.

Kept: hyperframes for export/render, `MotionEditorShell` and the `motion/[nodeId]` page (step 11).

Gaps the canvas-free specs exposed on the GPU path, fixed here:
- an empty canvas fitted the view onto the first drawn node, so it jumped away from the pointer;
- a new text did not open its caret; the caret now opens with the placeholder selected;
- a drawn element was reselected when its save landed, after the user had moved on;
- a free element could not be dragged, resized or turned as a node (`dragsHost`): its shape now
  stretches with the node (`fitElementToNode`) and elements get the rotate knob.

Known gap: edits on the GPU path do not refresh the stored poster; specs no longer assert it.
