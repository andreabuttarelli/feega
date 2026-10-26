# Group, frame, boolean ops and deep select inside a GPU canvas frame

Workstream B of the canvas-vs-Figma audit. Before: ⌘G/⇧⌘G grouped canvas
tiles even with elements picked inside a frame; boolean ops, outline stroke,
flatten and outline text existed only in `MotionEditorShell`; ⌘-click toggled
tile selection; a right-click inside a frame showed the tile menu.

Now, with elements picked in a frame:

- `frame-inspector.ts` is the one registry of element ops the canvas runs
  (`BAR_OPS`, async `LATER_OPS` for outline text, `PICKS` for select matching
  and select all siblings). The keys (`frameKeyAction`, read from the motion
  shortcut table), the right-click menu (`FRAME_ELEMENT_MENU`) and the panel
  `ClipBar` (`frameBarActions`) all read it.
- ⌥⌘G frames the selection (`wrapInFrame`): frames inside frames, through the
  `parent` link the doc already has. ⇧A toggles auto layout.
- A click picks the outermost container, or stays at the depth of the current
  pick; ⌘-click picks the deepest element (`clickTarget`, `Reach`).
- The scene records each layer's `owners` (the `data-clip` chain). A group is a
  Precomp whose members compose as `<group>__0__<id>`; the picker returned that
  namespaced id, so a group could be neither picked nor outlined. `framePicker`
  now returns the deepest owner the doc knows, and `rectOf` counts owners.
- A right-click no longer clears the in-frame pick before the menu opens.
- Italian labels in `canvas/shortcuts.ts` are English.

Not done: deep select into a group's members (they live in `doc.comps`, not in
the top-level selection model). A united path can draw past its clip box, so the
selection outline follows the old box; same as in the editor.
