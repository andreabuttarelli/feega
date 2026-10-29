---
title: Selection and shortcuts
description: Select nodes and the keyboard shortcuts of the canvas.
sidebar:
  order: 15
---

## Select

- Drag the background to draw a marquee.
- Shift-click or Cmd/Ctrl-click adds or removes a node.
- Cmd/Ctrl+A selects all nodes (not while typing in a field).
- Esc clears the selection.

## Select inside a frame

Picking inside a frame works like Figma, in the base frame and in every breakpoint view.

- The hover outline shows exactly what a click would select.
- A click selects the frame's top-level element under the pointer. A container that fills the whole frame, like a landing's page, counts as the frame: the click selects the section under the pointer.
- Double-click enters the selected container or component instance and selects its child under the pointer, one level at a time; on text it starts editing, on a shape without children it edits its points.
- A drag starts only once the pointer has moved a few pixels, so clicks and double-clicks never move anything. An element leaves its frame only when you drag it past the edge of the frame or view you are editing.
- Once inside a container, hover and click pick among its children. Clicking outside it goes back up.
- Cmd-click (Ctrl-click on Windows) selects the deepest element directly; holding Cmd/Ctrl while hovering previews it.
- Esc goes up one level.

With several nodes selected, dragging one moves all, and the selection bar shows the shared properties, editable once for all.

## Properties of a frame or a multi-selection

Selecting a frame opens its properties in the right bar.

- **Selection colours** lists every colour used in the frame, nested groups and pasted Figma vectors included, most used first with a count. Changing one swatch recolours every element that uses it, in one step you can undo.
- With several elements selected inside a frame, the right bar shows the properties they all have: text properties when all are text, plus layout, opacity and their selection colours. Values that differ read **Mixed**; editing one applies it to every selected element at once.

## Shortcuts

| Key | Action |
|---|---|
| Backspace / Delete | Delete the selection |
| Cmd/Ctrl+D | Duplicate; an element picked inside a frame is copied inside that frame |
| Cmd/Ctrl+C | Copy |
| Cmd/Ctrl+V | Paste at the centre of the view |
| Cmd/Ctrl+Z | Undo |
| Shift+Cmd/Ctrl+Z | Redo |
| Arrows | Move the selection |
| Arrows + Shift | Move by a longer step |
| 0 | Fit the whole canvas |
| + / = | Zoom in |
| - | Zoom out |
| 1, 2, 3... | Add the node type at that position of the bar |

None fire while typing in a text field, except Esc, which always closes an open menu or overlay. Deleting asks no confirmation.

## Copy a node id

The node menu copies its id, handy to refer to it in the chat.
