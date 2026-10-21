# Frame children select directly on the core canvas

The core canvas draws unselected frames as textures with no DOM tile, so `FrameHover` (which hit-tests a
frame's children and owns the pointerdown) only existed once a frame was selected. Hover and click on a
child fell through to the frame.

`hoverHostOf` (`motion-node.ts`) is the one table saying who hears the pointer: a tile with a DOM node
keeps `MotionNode`'s own `FrameHover`; a stand-in tile gets it as an overlay from the canvas page's
`tileOver`. Same component, same `DRILL` rules, so Cmd/Ctrl+click, multi-select and dragging by the
title are unchanged.
