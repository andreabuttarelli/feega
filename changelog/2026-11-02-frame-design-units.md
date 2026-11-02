# A frame reads in canvas px; export picks the resolution

Browser audit: on frames and their layers every inspector number was 2× the screen (700×460 frame
showed 1400×920, a 160 px rect W 320, radius 12 drew 6 px) while X/Y were canvas px. Drawn frames
were kept at 2 doc px per canvas px "for export" (0032); hand-resized frames were already 1×,
preset frames ~4.6×. Decision in [ADR 0033](../docs/adr/0033-a-frame-is-its-size-on-the-canvas.md).

- **One conversion.** `scaleOf(doc, node)` + `spaceOf(doc, scale)` (`units.ts`). The panel
  computes the scale from `frameProperties.place` (now `{x, y, w, h, set, resize}`) and passes it
  to `MotionInspector`, `MultiInspector`, `CameraInspector`; `AnimateToSection` takes the space.
  The element case of 0032 runs through the same path.
- **Frame size** (`FramePresetSection`) shows and sets the node box; W/H/presets call
  `place.resize` → `onResize`, the handle-drag path. `applyPreset`/`resizeTo` deleted.
- **Drawn frames at 1×.** `DOC_PX_PER_CANVAS_PX` 1 for frames and elements.
- **Export.** `DrawTarget.docScale`/`SelectionFrame.docScale` from the node record
  (`docScaleOf`); `rowSize` on the design size. `stillExport(format, scale, docScale)`; the editor
  still action reads the node. Defaults 2× in `ExportRows`, `StillExport`, CLI `canvas export`.
  The motion agent's `export_image` stays in doc px (`IN_DOC_PX`).
- **In-tab video** `exportSize` no longer caps at the doc size: same pixels as the farm.
- Not changed: the timeline's value fields still read doc px; legacy docs untouched.
