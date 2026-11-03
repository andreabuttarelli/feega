# The motion agent, MCP, the timeline and text styles speak canvas px

Leftovers of [ADR 0033](../docs/adr/0033-a-frame-is-its-size-on-the-canvas.md): on a legacy 2×
frame the inspector read canvas px, everything else doc px. The agent saw a 700 px frame as 1400,
the timeline value fields showed twice the inspector, and a 16 px project text style drew 8 px.

- **One boundary for the tools.** `toolSpace(doc, scale)` (`server/motion/tool-space.ts`):
  `frame` (`spaceOf`) replaces `session.doc` as the frame of every units conversion in
  `motion-tools.ts`; `toDoc`/`toCanvas` for raw px (arrange dx/dy/spacing, track offsets,
  depth, light falloff, guides, `set_canvas` sizes); `layoutIn`/`layoutOut`/`itemIn`/`itemOut`
  for stack gap, padding, fixed tracks and min/max. `docSummary(doc, selection, scale)` reports
  the canvas size, boxes, autoLayout, layoutItem and guides in canvas px.
- **Scale loaded where tools run.** `MotionToolDeps.scale` from `docScaleOf(record, doc)`
  (moved to `server/motion/doc-scale.ts`: mocked `editor` modules no longer hide it) in
  `turn.ts`, `tool-run.ts` (MCP `motion_tool`, `edit`), `motionSummary`. Absent = 1, doc px.
- **export_image** passes the scale: 1× is one image px per canvas px (was `IN_DOC_PX`).
- **Timeline** (`MotionTimeline` `scale` prop, from `FrameTimeline` and `GpuFlow`) converts
  through `spaceOf`.
- **Text styles.** `libraryOf` takes `{doc, scale}`; `adoptStyle`, `syncedDoc`, `offeredStyles`
  take the scale; `canvas-styles` reads it from the frame stage. Same `inLibrary`/`inDoc`.
- Not converted: `read_layer_css` (CSS text in doc px), `add_ui` radius, breakpoint widths,
  nested comp sizes (their own px). For new 1× frames none of this changes anything.
- Rejected: rescaling the doc for the tool run (custom component CSS and stored doc px).
- Tests: `motion-tools-canvas-px.test.ts`, `timeline-values-canvas-px.test.ts`, style-library and
  canvas-styles cases. No paid evals run.
