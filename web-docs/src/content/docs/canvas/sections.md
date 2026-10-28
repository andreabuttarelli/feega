---
title: Sections and groups
description: Move frames together with a section, and group layers.
sidebar:
  order: 2
---

## Sections

`Shift+S` wraps the selected frames in a section: they move together. `Cmd+Delete` removes only the section, not what is inside.

- Rename a section and change its colour from the toolbar.
- Drag a node into a section to keep it there, or out to release it.

### Feed a section into a node

A section has an output port. Draw an edge from it to a text, image or video node, inside the section or outside. On every run the node receives what the section holds at that moment: texts and docs join the prompt, images and videos become references, generated nodes give their current output. Explicit edges still count, and an item wired both ways is sent once.

- The node shows "Section: name · N items". Expand it to untick an item for that node only.
- A node inside the section never receives itself, and two nodes never feed each other.
- If the section holds more images than the model takes, the first ones are sent and the node says how many.
- Adding or removing nodes changes the next run. Nothing regenerates by itself.

## Groups

`Cmd+G` makes a light group: it fits its contents and disappears when emptied. `Shift+Cmd+G` ungroups. `⌥⌘G` frames the selection instead.

Boolean operations keep shapes editable: union (`⌥⇧U`), subtract (`⌥⇧S`), intersect (`⌥⇧I`) and exclude (`⌥⇧E`) redraw when you change a source shape. Flatten (`⌘E`) bakes the result into one path.
