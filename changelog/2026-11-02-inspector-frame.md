# Frame, group, main component and text defaults in Properties

Props audit H11; basics audit #15, #22, #27, #28.

- **Frame (H11).** With nothing inside picked, the panel showed only "Frame size" and a
  header "Shape" (the surface clip). `frameProperties.place` (published by `GpuFlow` from
  the node's x/y, written back through `onMove`) feeds `FramePlaceSection`: X and Y, and
  Rotate when the node is a free element (`frameProperties.turn`, a group or an image).
  The header reads the frame's name and renames the node (`frameProperties.rename` →
  `onRename`), kind "Frame".
- **Main component (#22).** The main showed Swap, Reset, Push and Detach. `roleOf` in
  `main-component.ts` reads the role from the comp's `home` and the frame shown: no home or
  this frame is the Main. `ROLE_PARTS` says what each role offers; the main keeps its
  properties and variants. Header kind "Main component". X/Y/W/H come from `BoxFields`.
- **Group (#27).** Landed meanwhile on dev as `ClipFamily.Group`; here the header and
  Layers both read "Group" through `layerLabel`/`layerKind`.
- **Multi-select style fields.** `sharedFields` offered the legacy flat paint keys (Fill
  type, Gradient end, Stroke width 6400) that the fill and stroke stacks replaced; it now
  skips them like the single inspector does.
- **Text (#28).** A click with the text tool on the canvas made a box 12% of the viewport
  tall (~72 px type). `canvasTextClick` sizes it for 16 px type at the current zoom.

Not done here: flip for frames and groups (no node flip exists; flip on a layer is the
basics audit blocker #1), frame rotation for real frames, align/constraints/auto-layout
entry on the frame itself.
