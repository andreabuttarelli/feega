# Rulers and user guides on the frame (parity T6)

Figma-style rulers were missing: layout guides existed, guides pulled by hand did not.

- `Rulers.svelte`, mounted by `FrameTools` behind `FrameOverlay.Rulers`: ticks on the top and left
  edges of the frame being edited, step from `tickStep(zoom)` so labels never crowd.
- Pulling from a ruler adds a guide, dragging one moves it, dropping it on the ruler or outside
  the frame deletes it (`dropOutcome`).
- Model: `doc.userGuides` (`motion-core/user-guides/model.ts`), per frame, saved with the doc.
  `canvas/user-guides.ts` holds the pure edits; `guideSnapBounds` adds the lines to the snap targets.
- Agent: `add_guide` / `remove_guide` in `motion-tools.ts`; `get_motion_doc` returns `userGuides`;
  parity table entry in `motion-agent-parity.test.ts`.
- View: `FrameView.Rulers` (default on), `Command.ToggleRulers` on `Alt+Shift+R` (`Shift+R` is the
  rectangle tool).
- Discarded: rulers on the viewport edges. Guides are frame-local, so the rulers measure the frame.
