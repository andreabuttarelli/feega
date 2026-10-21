# Select inside frames on the core canvas (unify step 4)

Selecting a frame or an element in it no longer mounts InlineMotionEditor: with `unifiedFrames` on (default) the frame stays core-drawn.

- One flag: `unifiedFrames(url)` in `frame-pick.ts`; the page passes it to `inlineMotionTarget`, so only an explicit request (double-click on a bare frame, properties) opens the old editor.
- Click picks a clip, double-click drills (`DRILL`), Esc goes up. State: `Inside` in `frame-select.ts`.
- `FrameSelection.svelte` draws outline and handles in `FrameOverlays`; drags go through `dragClip` (dragPatch + writePatch) and `FrameEditSession` (ops action of the motion page), the core redraws from `liveDocs`.
- Layers gets a `VideoSide` from `videoSide`, same selection.

Discarded: reusing SelectionOverlay as is (needs the DOM player's measure and html). Not covered: rotated frames, multi-select, text edit, inspector, timeline.
