# Animation authoring rest (AN-02, AN-06, AN-10, AN-11)

- AN-02: the mode existed (`edit-mode.ts`) with no switch on the canvas, and the canvas ignored
  it: a single drag keyed animated props (Animate behaviour) while a group drag shifted them
  (Design), and the inspector always wrote at frame 0. `FrameEditSession` now holds `mode` and
  `playhead`; `Drag.mode` and `nudgeClips(..., mode)` go through `writeTransform` (the table in
  `space.ts`); the inspector gets both. A switch in the timeline bar and the `E` key
  (`edit-mode` canvas command) flip it; the choice is remembered (`recalledMode`/`rememberMode`).
  Default is the remembered mode, else Animate (as `startMode` already said): single drags keep
  keying, group drags and nudges now key too unless you switch to Design.
- AN-06: snapping already covered clip edges, keys, markers, playhead, seconds and beats. The one
  gap was key drags: they snapped without showing the guide. Fixed in `MotionTimeline.svelte`.
- AN-10: "presets bake already" is true of expressions (`bakeExpressions` at render). New
  `expressionToKeys` bakes one clip property for good and drops the expression; button in the
  expression editor, MCP op `expression_to_keys`. Camera expressions are not covered. Text
  animator presets are live and were not touched.
- AN-11: grouping existed for layers (Cmd+G inside a frame) but the timeline could neither pick
  several segments nor group them. `FrameTimeline` shows the picks, offers Group / Ungroup
  (`frameBarActions`), and a group segment moves every clip in it (test in `group.test.ts`).
- Pins: the new op adds two entries to the tool pin and moves the `frame_tool` one (its
  description lists ops). Updated on purpose.
- Checked in Chromium on test@dazero.co: `~/Documents/feega-videos/e2e/r7-mode-*.png`,
  `r7-snap-key.png`, `r7-expression-*.png`, `r7-group-*.png`.
