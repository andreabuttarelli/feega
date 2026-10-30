# 0031 — Mains live on a Components page, one frame per set

Status: accepted 2026-10-30.

## Context

URL import drew every main into one "Components" frame beside the page: often 16k px tall,
mostly empty, slow to draw. The frame had to match the page size because a comp stores its
clip positions as fractions of the frame that holds it, and an instance follows its main by
copying the comp (`linked-mains.ts`): a smaller home would stretch every instance.

## How Figma and Framer do it

| | Figma | Framer | Feega |
|---|---|---|---|
| Where a main lives | Where it was made; a "Components" page is a team convention | A separate component canvas; the layer becomes an instance in place | The project **Components** page (a canvas named `Components`, made on first use) |
| Create component | The selection becomes the main in place | The selection moves to the component canvas, an instance stays | The main moves to its own frame on the Components page, an instance stays |
| Variant set | Dashed purple frame, "+" below it | Variants bar | Set frame with dashed purple outline, "+" below it |

## Decision

1. **The user chose Framer's behaviour** for every path that makes a main: `⌥⌘K` in the app
   and URL/code import. After `createComponent` the app saves, then calls `home_components`,
   which places the main in its own set frame on the Components page and homes the page's copy
   there (`component.home`). The instance never leaves the screen: the move runs in the
   background.
2. **One frame per set, sized to its content**, variants left to right, frames in a wrapped grid
   below whatever the page already holds (`component-sheet.ts`, `components-page.ts`).
3. **Comps keep pixels, not fractions, across frames.** `reframed(comp, from, to, shift)`
   (`comp-frame.ts`) rescales a comp between frame sizes. Following a main rescales it to the
   instance frame and anchors it to where the instance's copy already sat, so moving content
   inside the main never moves instances. Placing an instance from another frame rescales too.
4. **A set frame is recognised from its document** (`setMainOf`: only a backdrop and mains
   homed in it) **and only on the Components page**, so a design frame holding one instance is
   never mistaken for a set.
5. **Nothing is migrated.** Old imports keep their Components frame; same-size homes rescale by
   1 and anchor to themselves.

## Discarded

- A `frame` on every comp (own coordinate space): the renderer flattens comps in the host's
  fractions and ignores `comp.frame`, so it would have been an engine change across export,
  GPU and codegen.
- Moving mains on save: it would also move the mains of old Components frames.
- Agent `component create` homing on its own: the agent calls `home_components` like the app.
