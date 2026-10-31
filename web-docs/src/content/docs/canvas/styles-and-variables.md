---
title: Styles and variables
description: Shared styles and variables with modes.
sidebar:
  order: 5
---

## Styles

Styles belong to the project: every canvas and page of the project sees the same list. Apply one anywhere; changing it updates every frame that uses it, on any page.

- Open the Styles panel from the left rail (Alt+7) to create, edit, rename and delete text and colour styles.
- Text styles: edit font, size, weight, tracking and leading. Renaming a style renames it everywhere.
- Deleting a style unlinks its layers; they keep their current look.
- Styles already saved in older frames, and styles from a URL import, join the project library the first time their canvas opens. Nothing is overwritten: a project style with the same name wins.
- Effect and gradient styles: save shadows, blurs, gradients and image fills as styles.

## Variables

Define colour, number, text and on/off variables, with modes such as light and dark. Bind a layer field to a variable, then switch the mode to restyle everything bound.

- The Variables section is in Properties.
- Variable collections belong to the project, like styles: every canvas and page sees them. Each frame keeps its own mode.
- Collections from a URL import are saved to the project.
- Agents can create and bind variables through the [edit ops](/reference/generated/edit-ops/).

## Bind a field to a variable

Every colour, number, text and on/off field in Properties has a small diamond chip beside it.

1. Select a layer and find the field, for example Fill.
2. Click the diamond. The list shows the variables of the same type, with their value in the current mode.
3. Pick one. The field turns into a pill with the variable name and its value.
4. Switch the mode of the collection: every bound field follows it.
5. Click the cross on the pill to unbind. The field keeps its current value.

The chip appears once a variable of that type exists in the frame or in the project library. A bound fill replaces the fill stack of that layer.

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
