# One place per control

The editor showed the same action in up to four places: align on a bar
floating under the frame, in the right bar and in the right-click menu;
duplicate, upscale, export and the frame entries in the selection
toolbar, its "…" menu, the right bar and the right-click menu.

Rule now: right bar for properties, right-click menu for actions,
plus keyboard shortcuts.

Removed:

- the on-canvas align bar (`FrameOverlay.Align`, `AlignSide`,
  `alignSide`); align/distribute stay in the right bar;
- align entries in the canvas and in-frame right-click menus (the
  `Alt+A/H/D/W/V/S` shortcuts still work);
- the "Actions" section of the node right bar (image tools, View
  output) and the frame actions list in the frame right bar;
- the selection toolbar's pinned buttons, its "…" action list and
  Delete; it keeps model/settings, Run, View, Compare, colour tag and
  export to cloud, which have no other home;
- `toolbarSlots`, `actionsFor`, `panelActionsFor`,
  `FRAME_PANEL_ACTIONS`, `elementToolbarActions`.

Moved into the right-click menu so nothing lost its only home:
run/connect, the image tools, frame code/interactive/components/
templates/history/chat/save template/publish, copy link, copy id,
report. Gated entries (Run from here, Re-run out of date) are hidden
when disabled.

Kept: Go to main component in the right-click menus, Layers menu and
the right bar header menu. Voice-over and music stay in the Sound
section. The right bar header "…" (frame bar) was left as is.
