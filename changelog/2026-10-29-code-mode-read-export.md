# Code mode: read and export only (#1515)

Code mode (ADR 0023, `docs/specs/editor-modes.md`) absorbs the Export code dialog and locks editing.

- `MODES` gains `access: DocAccess` (Write/Read). `FrameEditSession.access` gates `edit`, `recordEdit`, `amendRoot`, `recordRoot`, `undo`, `redo`: every frame edit path is refused in one place. GpuFlow sets it on each session from the mode and derives `editable`/`connectable` for node drag, resize, rotate, ports and double-click typing/crop.
- `DevCode` (from draft #1512) shows the frame code inline in the right bar: React/HTML/Svelte, copy, zip download. `CodeExport.svelte` and `FrameDialog.Code` are deleted.
- "…" > Export code… is a row of `FRAME_MODE_ACTIONS` (action → mode), next to `FRAME_DIALOG_ACTIONS`, so Interactive → Play can follow the same table.
- Mode switch highlight lag was real: `SegmentedControl` faded the checked background over 120 ms, so a screenshot right after a switch caught the old segment. The background now changes instantly; only text colour transitions.

Discarded: reusing `CanvasMode.View` — it also hides chrome and disables selection.
