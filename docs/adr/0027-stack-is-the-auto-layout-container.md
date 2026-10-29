# 0027 — A Stack is the auto layout container, read as a kind

Status: accepted 2026-10-29. Builds on [0008](0008-auto-layout-is-resolved-at-render.md).

## Context

"Add auto layout" becomes "Wrap with stack": a Stack is a first-class element on the canvas —
inside a frame or free — that lays its children out like flexbox. Two shapes were possible:

1. A new `Stack` component in motion-core, with its own schema and registry row.
2. The container that already exists — a rectangle `Shape` with `autoLayout` — read as a Stack.

## Decision

Option 2. A Stack is a clip whose `autoLayout` is set; `layoutKind(clip)` in
`packages/motion-core/src/motion/layout/stack.ts` is the one place that says so, with a row per
direction: horizontal and vertical are `Stack`, grid is `Grid`. Labels, Layers icons, the
inspector section and the actions all read that kind; nothing stores it.

- **No migration.** Every auto layout container ever saved is a Stack the moment it is read.
- **One visual model.** Fills, per-side strokes, corners, opacity, blend, effects and clip content
  are the `Shape` props the renderer, the inspector sections and codegen already handle. A new
  component would have had to copy each of them or forward to `Shape`.
- **Cross-axis stretch** is a new `Align.Stretch`: children that hug the cross axis take the line
  (CSS `align-items: stretch`); fixed children keep their size.
- **Wrap with stack always wraps.** The selection becomes the children of a new Stack, even when
  it is one clip that already has children. "Remove stack" unwraps: the children keep the boxes
  the layout gave them and move to the Stack's parent, the Stack is deleted.
- **Free elements.** Wrapping free elements on the canvas merges them into one free element node
  whose doc holds the Stack; that node follows the Stack's hugged size after every edit.

## Rejected

- A `kind: 'stack'` field written on the clip: a second source of truth next to `autoLayout`,
  and every old container would need a write to show as one.
- A `Stack` component: see above — a fork of `Shape` for one extra field.
