# Right bar for canvas selections, mask in frames, long-press menu

Issue #1521, spec `docs/specs/editor-modes.md`.

- The right bar showed only frame properties; a generated image/video had its model, settings
  and tools in the selection toolbar only. `GpuFlow` now publishes the canvas selection into
  `selectionProperties`; `FrameInspectorPanel` renders `NodeInspector` when no frame session is
  open. Model/settings derivation moved out of `SelectionToolbar` into `genPropertiesOf`, so
  toolbar and bar read the same values. The toolbar stays.
- Bar actions come from `panelActionsFor` (one table in `selection-actions.ts`, gated by the
  same `shownFor` as the toolbar).
- Align/distribute: free elements reuse `alignTiles`/`distributeTiles`; layers inside a frame
  (Multiple view) reuse `alignSpace`/`distributeSpace` with the session mode. Same `AlignBar`
  as the floating frame tools.
- Use as mask / Remove mask had a command and a `FRAME_COMMAND` row but no `BAR_OPS` entry, so
  the in-frame menu filtered them out and nothing ran them on canvas. Now in `BAR_OPS` and the
  structure list, so both the right-click menu and the bar header run them.
- Frame "…" entries (export, components, templates, history, branches, interactive, chat,
  save as template, publish, copy id, report) get a bar section via `FRAME_PANEL_ACTIONS`.
  Voice-over/music left to the Motion panel work (#1517).
- Long-press: the canvas had its own timer that only fired on a node hit, so elements inside
  frames never got a touch menu. Replaced by `pressMenu` on the surface, which runs the same
  `openMenuAt` as right click. `pressMenu` now cancels on a second finger (pinch opened the
  menu before).
