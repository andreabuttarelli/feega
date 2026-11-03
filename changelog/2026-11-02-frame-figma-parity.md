# Frames and groups turn, flip and stack like Figma

From the basics, props and nesting audits (2026-11-02): #1, #15, #21 (flip), H11 (frame
inspector), M6 (Layers drop).

- **Flip on frames and groups.** `⇧H`/`⇧V` with canvas nodes selected was not a canvas command:
  only layers inside a frame flipped. `flipStage` (`motion/layer-props.ts`) mirrors a whole doc by
  rewriting the root clips' transforms only (offset, scale sign, rotation and skew negated, around
  each root's pivot), so children follow through the parent chain and no layout prop moves.
  `mirrorGroup` (`canvas/node-layout.ts`) mirrors node boxes across a group's own axis; GpuFlow
  `flipNodes` applies both, recursing into group members, then turns a rotated node the other way.
  A multi-selection mirrors across its bounds. The whole flip is one undo step: the page's undo
  stack gained a `batch` entry fed by `undoStack.collect`.
- **Frames turn.** `Chrome.turns` was false only for frames, and it gated the rotate handle and
  the server's `rotateNodeGroup`. Every doc node now turns, so the flag is gone; the MCP
  `rotate_group` description says so.
- **Frame inspector.** `NodePlace` carries rotation, `turn`, `flip` and `align`. The frame panel
  shows the align bar (enabled only inside a group or section, via `alignWithin`), X/Y, Rotate,
  flip buttons, and an **Auto layout** `+`. Group rotation from the field goes through the same
  `onRotate` as the handle, so members turn around the group centre.
- **Auto layout on a frame.** `stackFrame` (`layout/ops.ts`) parents every layer to the frame's
  surface and gives the surface auto layout (`addAutoLayout`, fixed size); `⇧A` on a selected
  frame node does it too. Inside a frame, `⇧A` on a lone frame clip adds auto layout to it instead
  of wrapping it. The Stack section is allowed in the frame view.
- **Layers drop.** An empty frame row only offered above/below. Rows of clips with `clipContent`
  carry `frame`, which makes the middle of the row drop inside. `wrapInFrame` now sets
  `clipContent` (Figma frames clip), so a ⌥⌘G frame stays a frame once emptied.

Not done: constraints on a canvas frame. A frame node has no parent frame to pin to (Figma shows
none for a top-level frame); frames made inside a frame already show them.
