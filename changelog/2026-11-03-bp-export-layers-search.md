# Breakpoint views export; Layers search scoped to the frame

- **Export a breakpoint view.** Right-click on a view's label (or the view, where no element sits)
  opens a menu with Export. Path: `openMenuAt` in `GpuFlow.svelte` -> `props.onExport([viewId])` ->
  `ExportDialog` -> `exportFrames` in the canvas page -> `exportSelection` action, which turns
  `<node>@bp:<id>` into a target with `breakpointId` -> `exportSelection` resolves the doc with
  `inView` and names the file `<frame> <breakpoint>`. Unknown breakpoint = `frame_not_found`.
- **Layers search** only matches rows of the current frame (open frame, else the selected node);
  with no frame it still searches everything.
- **Enter on a layer row** selects its children (Figma). It no longer starts rename: double-click
  and Cmd/Ctrl+R remain.
- Picking a result of another frame already selected the frame and then the layer once it opened;
  covered by a test now.
