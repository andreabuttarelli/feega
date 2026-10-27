---
title: Keyframes and easing
description: Animate properties over time.
sidebar:
  order: 2
---

## Design and Animate

A switch under every frame (key `E`):

- **Design:** moving an element moves the whole animation.
- **Animate:** a change is keyed at the playhead.

## Keyframes

- **Animate to:** pick a property, type where it should end up; keyframes are created from the current value.
- **In / Out presets:** one click for fade, slide, scale, blur, pop and typewriter. See [In and Out presets](/motion/in-out-presets/).
- Reveal animated properties of the selection with the reveal commands (position, scale, rotation, opacity).
- Gradient stop colours, positions, angle, centre and radius can be keyframed.
- A shape can morph into any other shape.
- **Convert to keys** turns an expression into plain keyframes you can edit by hand.
- Copy and paste keyframes with `Cmd+C` / `Cmd+V`.

## Easing

**Unverified:** the list of easing curves and where the picker lives. The design rule in `DESIGN.md` is strong in-out expo-like curves with a tiny settle at the end; the editor's own list is in the motion code.
