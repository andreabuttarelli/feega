---
title: Interaction states
description: Hover, Pressed and Focus states on any layer, with their own easing and duration.
sidebar:
  order: 13
---

Any layer — text, shape, frame or image — can have up to three interaction states: **Hover**,
**Pressed** and **Focus**. The layer as you drew it is the **Default** state. A state only stores
what changes:

| Property | Value |
|---|---|
| Opacity | 0 to 1 |
| Scale | 1 is the drawn size |
| Rotation | degrees |
| Blur | px |
| Fill, Stroke | colour |
| Stroke width, Corner radius | number |

Each state has a transition: an **easing** (Standard, Enter, Exit, Linear, Overshoot) and a
**duration** in milliseconds (default Standard, 200 ms). The same curve plays going into the
state and coming back.

This works like Figma's interactive components ("While hovering", "While pressing" with Smart
Animate) and Framer's Hover and Pressed variants, without making a component or a copy of it.

## Ask the agent

> Give the button a hover state: fill #2255ff, scale 1.04, 250 ms enter.

The agent uses `set_element_state` and `remove_element_state`; MCP clients reach them through
`edit`.
