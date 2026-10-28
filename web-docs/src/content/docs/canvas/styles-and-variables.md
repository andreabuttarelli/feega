---
title: Styles and variables
description: Shared styles and variables with modes.
sidebar:
  order: 5
---

## Styles

Styles are shared by every frame on a canvas. Apply one anywhere; changing it updates every frame that uses it.

- Text styles: edit font, size, weight, tracking and leading from the canvas Styles list. Renaming a style renames it across every frame.
- Effect and gradient styles: save shadows, blurs, gradients and image fills as styles.

## Variables

Define colour, number, text and on/off variables, with modes such as light and dark. Bind a layer field to a variable, then switch the mode to restyle everything bound.

- The Variables section is in Properties.
- Variables are shared across the frames of a canvas. Each frame keeps its own mode.
- Agents can create and bind variables through the [edit ops](/reference/generated/edit-ops/).

## Bind a field to a variable

Every colour, number, text and on/off field in Properties has a small diamond chip beside it.

1. Select a layer and find the field, for example Fill.
2. Click the diamond. The list shows the variables of the same type, with their value in the current mode.
3. Pick one. The field turns into a pill with the variable name and its value.
4. Switch the mode of the collection: every bound field follows it.
5. Click the cross on the pill to unbind. The field keeps its current value.

The chip appears once a variable of that type exists in the frame or in the canvas library. A bound fill replaces the fill stack of that layer.

<video src="/videos/variable-bind-chips.mp4" poster="/videos/variable-bind-chips-poster.jpg" controls muted loop playsinline width="100%"></video>

### Agents and CLI

Agents bind with `bind_variable` and free with `unbind_variable`, the same two steps as the chip:

```json
{ "tool": "bind_variable", "input": { "clip_id": "hero-cta", "target": "fill", "variable": "Theme/surface" } }
{ "tool": "unbind_variable", "input": { "clip_id": "hero-cta", "target": "fill" } }
```

From the CLI, through the motion tool runner:

```bash
feega motion tool <nodeId> bind_variable --input '{"clip_id":"hero-cta","target":"fill","variable":"Theme/surface"}'
```
