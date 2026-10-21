# A free element is an element everywhere

After #1089 a box, circle or text on bare canvas was `kind: element`, but the selection still opened the frame timeline and the layers tree drew it with the frame clapperboard.

The `CHROME` table in `src/lib/canvas/motion-node.ts` now decides both: `timeline` (the timeline dock mounts only where true) and `selectsOwnClip` (selecting the element selects its single clip, so Properties shows shape properties). The tree row for an element uses the shape icon, still one top-level row. Frame dialogs were already frame-only in `selection-actions.ts`.

Not done: the text/rect/ellipse distinction in the tree icon; the node row carries no clip component, so all elements share the shape icon.

Spec: `tests/e2e/canvas-free-insert.spec.ts`.
