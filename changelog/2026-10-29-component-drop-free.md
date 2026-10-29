# Component drop: free instances and a drop highlight

A component dragged from the Components panel onto empty canvas did nothing:
`GpuFlow.dropComponent` only knew frames and returned silently. On a frame it worked.

- `componentDropTarget` (`src/lib/canvas/component-drop.ts`) decides frame vs canvas in one
  place; a free element under the pointer no longer swallows the drop.
- Empty canvas: `placeComponent` (server, `move-element.ts`) places the instance in a copy of the
  source doc, lifts it as an element and lands it as a free element on the current canvas, the
  same path `copyElement` uses. Page action `placeComponent`, agent op `place_component`.
- Dragging shows the component poster as preview and outlines the target frame.
