# Figma paste: layer names and skipped list in frames

`layerName` ignored `clip.name`, so names set by the Figma paste never reached the timeline Layers
panel. It now prefers the clip's own name.

`pastedInFrame` already returned the skipped list for Figma but its type hid it and `GpuFlow` dropped
it. Pasting into a frame now shows it as a status line, like the canvas-level paste.
