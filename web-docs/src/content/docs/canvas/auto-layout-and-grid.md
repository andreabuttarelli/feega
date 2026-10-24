---
title: Auto layout and grid
description: Let a container place its children.
sidebar:
  order: 6
---

`Shift+A` adds auto layout to the selection, or removes it from an auto layout. Auto layout is a field on a parent that is resolved into plain boxes at render time ([ADR 0008](/architecture/adr/0008-auto-layout-is-resolved-at-render/)).

## Stack

- Direction horizontal or vertical, wrap, gap, cross gap, padding per side.
- Padding takes CSS shorthand: `8`, `8 16`, `8 16 24`, `8 16 24 32`.
- Wrapped layouts can spread lines over the full height, draw the first child on top, and count inside strokes as padding.
- Children size fixed, hug or fill, with min and max.

## Grid

Grid auto layout has fixed, fractional and hug columns and rows, spans, per-cell alignment and column-first fill.

## Related

- `Shift+A` on selected tiles on the canvas stacks them into a row or column.
- Tidy up: `Ctrl+Alt+T`. Distribute with an exact gap by typing it next to the distribute buttons.
- Layout guides take an auto count, min, max or centre alignment, a colour and an opacity; elements snap to their edges.
- Lock the aspect ratio of an element from the inspector; hold `Ctrl` to resize freely.
