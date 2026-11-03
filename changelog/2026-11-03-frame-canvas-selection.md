# ⌥⌘G frames free elements on the canvas

From the text/shortcut audit (#12). ⌥⌘G framed elements inside a frame only; on the canvas there
was no op that wraps free nodes in a frame.

- `frameElements` (server, `element-groups.ts`) reads the picked free nodes, builds a custom
  frame doc at their union (`drawnFrame`, the same doc the frame tool draws, white surface
  included), carries each clip where it was (`placeAll`, shared with grouping) and removes the
  sources. Frames among the picks are refused: a frame goes into another by dropping it.
- Exposed three ways in this change: the canvas action `frameElements` (optimistic tile from
  `framedLocally`, undo from the server), the agent op `frame_elements`, and ⌥⌘G on the canvas.
- One element can be framed, as in Figma.
