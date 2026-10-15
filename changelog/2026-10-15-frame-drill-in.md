# Drill into frames like Figma

A click on a closed frame selected the frame and nothing else could be reached from the canvas;
inside the open editor, a second click on the selected clip jumped to a part, so click meant two
things depending on what was selected.

Now one table, `DRILL` in `src/lib/motion/drill.ts`, says what each gesture (hover, click,
double-click, ⌘-click, Enter, Esc/⇧Enter) selects at each depth (canvas, frame, clip, part). The
overlay (`SelectionOverlay.svelte`), the closed frame (`FrameHover.svelte`) and the keys in
`MotionEditorShell.svelte` all ask it. Spec in DESIGN.md, "selecting inside a frame".

Decisions:

- Click stays at the current level; descending is a double-click. The double-click is resolved
  from the level before its first click, or it would descend twice.
- A closed frame measures its children once, on the first pointer enter, with a hidden probe
  (`PartsProbe`, now with `Pose.Posed`: boxes as drawn, transforms on, because there is no doc
  to transform with). Cached per node revision. Hover changes one outline div, no node re-render.
- The first click of a double-click opens the editor and unmounts the closed frame, so the
  second never reaches it. The click is queued (`frameDrill`), upgraded to a double-click by a
  one-shot window `dblclick` listener, and read by the overlay after its first measure.
- ⌘-click on a closed frame stops the event (xyflow would toggle the node out of the selection)
  and opens the frame through `CanvasSide.open`, which also clears a dismissed editor.
- Esc in the canvas editor climbs one level and closes only at frame level.
- `SelectChild`/`SelectParent` are view commands: no agent tool, parity marks them VIEW.

Not done: clips inside a non-template precomp are listed in Layers but not measured on the
stage, so the drill stops at the precomp clip.

Tests: `drill.test.ts`, `frame-drill.test.ts`, `frame-hover.test.ts`, posed cases in
`measure.test.ts`; e2e `canvas-drill-in.spec.ts` (test account, no model calls).
`canvas-poster-parts.spec.ts` now double-clicks to reach a part.
