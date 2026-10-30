# Layer ops in the right-click menu

Issue #1521, spec `docs/specs/editor-modes.md`.

- Create/detach/push/reset instance had commands and `FRAME_COMMAND` entries but were missing
  from `MENU_ORDER`, so no menu showed them. Hide, lock, copy/paste properties were keys only.
- New ids `hide` `lock` `copy-properties` `paste-properties` in `selection-actions.ts`, mapped in
  `frame-menu.ts` to the existing commands, all frame-only. The right-click menu inside a frame
  runs them through `FRAME_ELEMENT_MENU` → `barAction`.
- Hide/lock stay out of the right bar: the spec puts them in the Layers row and the context menu.
- Instance ops in `FRAME_ONLY` also fixes the canvas handler type (`CanvasActionId` no longer
  asks the canvas to run them).
