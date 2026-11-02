---
title: Frames and free elements
description: What lives inside a frame, and what sits free on the canvas.
sidebar:
  order: 1
---

A **frame** is a node with its own size, content and timeline: a video, a poster, a screen. Frames can nest: draw one inside another with the Frame tool and it keeps its own fill and clips what is inside it.

A **free element** is a shape, text, image or SVG placed directly on the canvas. It is saved as an element, never as a frame, so duplicating or copy-pasting it keeps its drawing and size. Technically a free element is a chromeless frame ([ADR 0011](/architecture/adr/0011-a-free-canvas-element-is-a-chromeless-frame/)).

## A free element is one object

A free element behaves like a single object, as in Figma ([ADR 0032](/architecture/adr/0032-a-free-element-is-its-node/)):

- **X**, **Y**, **W**, **H** and rotation in the right bar are its place and size on the canvas, in canvas pixels. Typing them, scrubbing their label or nudging with the arrow keys (`⇧` for 10 px) moves, resizes or turns the element itself; one `⌘Z` undoes each.
- Every other pixel value (type size, corner radius, stroke, blur, shadow, gap and padding) is in canvas pixels too.
- Changing the type size, weight or spacing of an auto-width text grows its box. Dragging a text's handle stops it hugging that side.
- Rotate 90°, flip horizontal and flip vertical turn and mirror it in place, around its centre.
- `⌘D` duplicates it as a new element on the canvas.
- Shadows, glows and outer strokes show past its edge. There are no constraints: a free element has no frame to pin to.
- An agent moving, resizing or turning the element's layer moves, resizes or turns the element.

## Moving things

- Drag an element out of a frame into another frame or onto the canvas. Both frames, and the new element, change at once; saving continues in the background, and a move that cannot be saved is put back with a notice.
- Drag a generated image or video from its node into a frame.
- `Delete` or `Backspace` on a free shape removes it entirely; no empty frame is left behind.
- Paste an element into several selected frames at once.
- Hold `Cmd`/`Ctrl` while resizing a frame to leave its layers at their size and place.
- New layers are pinned left and top, so resizing a frame keeps their size and distance from the edges.
- `Resize to fit` (`⌥⇧⌘R`) fits a frame to its contents.

## Styling the frame

With nothing inside the frame selected, the right bar shows the frame's own look, with the same controls as a layer:

- **Align**: aligns the frame inside the group or section that holds it; with nothing around it the buttons stay off, as in Figma.
- **X**, **Y** and **Rotate**, plus **flip horizontal** and **flip vertical** (`⇧H`, `⇧V`). A frame turns from the field or by dragging just outside a corner. Flipping mirrors everything inside it; `⌘Z` undoes the whole flip in one step.
- **Frame size** preset, **W** and **H**, and **Layout grid**.
- **Auto layout** `+` (or `⇧A` with the frame selected) turns the frame itself into a stack: its layers line up in a row or column, and the frame keeps its size. The **Stack** section then edits direction, gap and padding. `⇧A` on a frame inside a frame does the same to that frame instead of wrapping it.
- **Appearance**: opacity (fades the frame and every layer in it; at 0% the canvas shows through) with its slider and the eye that hides the layer, corner radius with its slider (uniform or per corner), blend mode and **Clip content**. Drag a slider, drag a field's label to scrub, or click the value to type.
- **Fill**: several fills, each a colour, gradient or image.
- **Stroke**: colour, width, inside/center/outside, per side.
- **Effects**: drop and inner shadows, layer and background blur.

The first edit gives the frame a surface: a locked full-frame layer under every other, named `Frame`, that replaces the brand background. It is not listed in Layers and a click on it selects nothing. **Clip content** is on by default: layers are cut to the frame's rounded corners in the editor, the player and exports. Code export paints the page root with it. Agents add it with `set_canvas` `surface: true` and style it with `set_props`.

Scenes, camera, breakpoints, prototype flow, styles and variables sit in the folded **Frame settings** group below.

## Selecting

- Right-click on stacked layers lists them so you can pick the one underneath.
- Right-click a layer to hide (`⇧⌘H`), lock (`⇧⌘L`), copy properties (`⌥⌘C`) or paste them (`⌥⌘V`). A locked layer, and everything inside it, stays put when dragged.
- The same keys work on whole nodes on the canvas: frames, images and groups. A hidden node is not drawn and cannot be clicked; its row in Layers is dimmed. A locked node cannot be moved, resized or rotated, but you can still select it from Layers. Each node row in Layers has its own eye and lock, and `Cmd+Z` undoes either.
- Hold `Alt` while dragging an element inside a frame to drag a copy; the original stays where it was.
- A group turns and flips as one: rotating it from **Rotate** turns everything in it around the group's centre, and `⇧H`/`⇧V` mirror its contents across its middle.
- Hold `Cmd`/`Ctrl` and drag across a frame to select elements inside groups, not the groups.
- `Cmd+F` finds any node by name, text or prompt.

Frames rest on their first moment on the canvas, so pasted designs and drawn shapes are always visible.
