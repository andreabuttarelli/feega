# Inspector and ClipBar as canvas panels (unify step 6)

With `unifiedFrames` on, an element selected inside a core frame opens `FrameInspectorPanel` on the right of the canvas.

- The panel is fed by the frame's `FrameEditSession` (`saverOf` in `GpuFlow.svelte`): edits go through `session.edit`, save through its queue, `port.show` republishes to `liveDocs` and the core redraws.
- `MotionInspector`, `MultiInspector`, `LookInspector` and `ClipBar` already took `doc`/`onchange`/`gesture` as props, so none changed; the shell is untouched.
- Pure parts in `canvas/frame-inspector.ts`: `inspectorOf` (clip / multiple / nothing) and `barAction` (split, duplicate, delete through `runClipOp`).

Discarded: reaching into `MotionEditorShell` state. Not covered: asset pickers (empty list until assets are published per frame), playhead (frame 0 until step 7), open composition, parent-to, multi-select from the canvas, parts.
