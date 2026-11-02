# 0032 — A free element is its node

Status: accepted 2026-11-02.

## Context

A shape, text or Stack drawn straight on the canvas is an `element` node that holds a doc with one
root clip. The inspector edited that doc as if it were a frame: lengths came out in doc px (two
per canvas px for a drawn element), X/Y read 0 and moved the shape inside an invisible box, W/H
scaled the shape while the box stayed put, and undo restored the doc but not the box. The user saw
two objects where Figma shows one.

## Decision

1. **The node owns placement.** X, Y, W, H and rotation of a free element are the node's, in
   canvas px. The root fills its doc's stage and stays upright.
2. **One normaliser, client and server.** `settleElement(doc, box)` in
   `src/lib/motion/element-host.ts` folds any root offset, size or turn left in a doc back into the
   node box and re-stages the doc holding pixels (strokes and type keep their size on screen). The
   canvas runs it after every recorded edit; `saveMotionDoc` runs it for every agent or MCP write.
   It replaces `elementTurn`, which did the same for rotation only.
3. **The inspector edits the node through a bridge.** `ElementHost` (box, `move`, `resize`,
   `turn`) is published for the root of a free element: X/Y move the node, W/H resize it the way
   a handle drag does, rotation turns it. A scrub coalesces into one edit.
4. **One unit conversion.** `spaceOf(doc, node)` in `src/lib/motion/units.ts` is the stage as the
   user sees it: the node box for an element, the doc for a frame. Every px field converts through
   it; lengths without a basis (`Basis.Pixel`, effect params marked `len` in the effects registry)
   scale by `node.w / doc.width`. New elements are drawn one doc px per canvas px, so the factor is
   1 for them and only older 2× elements need it.
5. **The box rides along with history.** `HostLedger` remembers the node box each doc was left
   with; stepping back or forward to a doc puts the node back in that box.
6. Constraints are hidden on a free element: there is no frame to pin to.

## Rejected

- Rescaling old 2× docs to 1× on open: a write to every element ever drawn, and every px quantity
  in the doc (gap, padding, effects) would need a table just to keep its look.
- Routing W/H through root props and the normaliser alone: text props cap at the stage, so a text
  could never grow from the inspector.
