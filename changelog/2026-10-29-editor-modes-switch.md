# Editor modes: one global switch in the header

Issue #1514, spec `docs/specs/editor-modes.md`, ADR 0023.

Before: each frame's properties panel carried a row with a Design/Motion segmented control and a "Coder mode" button. Mode was per frame (`toggledModes` in `GpuFlow`, `EDIT_MODE_KEY` in localStorage); Coder mode was a frame view (`FrameView.Dev`).

Now: `src/lib/canvas/editor-mode.svelte.ts` holds one `EditorMode` (Design, Motion, Play, Code) and a `MODES` registry: label, the `EditMode` edits use, which inspector the right bar shows, where `E` and `⇧D` lead. #1515–#1517 add behaviour as fields of that table, not as ifs. `EditorModeSwitch` sits top-centre in `CanvasTopBar`. GpuFlow derives every frame session's `EditMode` from it (stills stay Design via `startMode`). `⇧D` is a `code-mode` canvas command, no longer a frame view. Play renders a placeholder.

Removed: `FrameModeRow`, `FrameView.Dev`, `frameProperties.dev/toggleDev`, `FrameEditSession.toggleMode` and its `moded` port, `shownMode/recalledMode/rememberMode/nextMode`. The old per-frame stored mode is not migrated: the new key starts at Design.

Not done here: mobile bottom pill (switch hidden under 768px), Play behaviour, Motion recording border.
