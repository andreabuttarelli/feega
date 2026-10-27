---
title: Frames and free elements
description: What lives inside a frame, and what sits free on the canvas.
sidebar:
  order: 1
---

A **frame** is a node with its own size, content and timeline: a video, a poster, a screen. Frames can nest: draw one inside another with the Frame tool and it keeps its own fill and clips what is inside it.

A **free element** is a shape, text, image or SVG placed directly on the canvas. It is saved as an element, never as a frame, so duplicating or copy-pasting it keeps its drawing and size. Technically a free element is a chromeless frame ([ADR 0011](/architecture/adr/0011-a-free-canvas-element-is-a-chromeless-frame/)).

## Moving things

- Drag an element out of a frame into another frame or onto the canvas.
- Drag a generated image or video from its node into a frame.
- `Delete` or `Backspace` on a free shape removes it entirely; no empty frame is left behind.
- Paste an element into several selected frames at once.
- Hold `Cmd`/`Ctrl` while resizing a frame to leave its layers at their size and place.
- New layers are pinned left and top, so resizing a frame keeps their size and distance from the edges.
- `Resize to fit` (`⌥⇧⌘R`) fits a frame to its contents.

## Selecting

- Right-click on stacked layers lists them so you can pick the one underneath.
- Hold `Cmd`/`Ctrl` and drag across a frame to select elements inside groups, not the groups.
- `Cmd+F` finds any node by name, text or prompt.

Frames rest on their first moment on the canvas, so pasted designs and drawn shapes are always visible.
