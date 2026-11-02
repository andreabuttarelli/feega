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

In the Layers panel, Shift-click selects every row between the last picked one and the clicked one; Cmd-click (Ctrl-click on Windows) adds or removes one row. It works on canvas nodes and on the elements inside a frame, and the canvas and the right bar follow.

The Layers panel lists what the canvas has loaded: a page far off screen shows as one row, and its elements appear once the canvas loads it.

## Align

- With two or more elements selected, align moves them to the edges or centre of the selection's bounds: a small element over a big one centres on it, and the big one stays put. Distribute spreads three or more evenly.
- With one element selected, align places it inside its parent: the frame, or the container it sits in. In a stack, the alignment across the stack sets the element's align-self.
- Align from the right bar, the right-click menu or the Alt shortcuts (Alt+A, Alt+H, Alt+D, Alt+W, Alt+V, Alt+S).

With several nodes selected, dragging one moves all, and the selection bar shows the shared properties, editable once for all.

Several shapes, texts or frames selected on the canvas get one box around them all. Its handles resize the whole selection (Shift keeps the ratio, Alt scales from the centre) and the corners just outside it rotate the selection around its centre (Shift snaps to 15°). Properties stays open with X, Y, W, H and rotation for the selection: a value the nodes share is shown, the others read **Mixed**, and typing one applies it to every node. One undo puts the whole selection back.

## Properties of a frame or a multi-selection

Selecting a frame opens its properties in the right bar.

- **Selection colours** lists every colour used in the frame, nested groups and pasted Figma vectors included, most used first with a count. Changing one swatch recolours every element that uses it, in one step you can undo.
- With several elements selected inside a frame, the right bar shows the properties they all have: text properties when all are text, plus layout, opacity and their selection colours. Values that differ read **Mixed**; editing one applies it to every selected element at once.

## Groups and frames inside a frame

- **Cmd/Ctrl+G** groups the selection. A group has no fill, radius or stroke of its own: its
  box is the box around what it holds, and the right bar shows its position, size, appearance
  and effects. Changing X, Y, W or H moves and scales everything inside it.
- **Shift+Cmd/Ctrl+G** ungroups. Inside a stack, the layers go back into the stack where the
  group was.
- **Option/Alt+Cmd/Ctrl+G** wraps the selection in a **Frame** and selects it.
- Grouping or framing children of a stack keeps the new group or frame in the stack, at their
  place.
- Deleting a stack, a group or a frame deletes what it holds.

## Edits show at once

Delete, group, ungroup, wrap with stack, wrap in a section, bring to front or back, rename,
a wire's mode and dropping a free element into a frame change the canvas on the same frame you
act. They save in the background, in the order you made them. Undo works while they are still
saving. If the server refuses one, the canvas puts it back and says so.

## Shortcuts

| Key | Action |
|---|---|
| Backspace / Delete | Delete the selection |
| Cmd/Ctrl+G | Group |
| Shift+Cmd/Ctrl+G | Ungroup |
| Option/Alt+Cmd/Ctrl+G | Frame the selection |
| Cmd/Ctrl+D | Duplicate; an element picked inside a frame is copied inside that frame |
| Cmd/Ctrl+C | Copy |
| Cmd/Ctrl+V | Paste at the centre of the view |
| Cmd/Ctrl+Z | Undo, resizing included |
| Shift+Cmd/Ctrl+Z | Redo |
| Arrows | Move the selection |
| Arrows + Shift | Move by a longer step |
| Shift+1 / Shift+2 | Zoom to fit everything / the selection, up to 400% |
| + / = | Zoom in |
| - | Zoom out |
| 1 to 9, 0 | Opacity of the selection: 10 to 90%, 0 for 100% |

None fire while typing in a text field, except Esc, which always closes an open menu or overlay. Deleting asks no confirmation.

## Copy a node id

The node menu copies its id, handy to refer to it in the chat.
