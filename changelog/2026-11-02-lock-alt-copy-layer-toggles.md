# Lock holds, Alt-drag copies, free elements get layer toggles

From the basics audit (`~/Documents/feega-videos/audit/basics/FINDINGS.md`).

- **#10** `holdsLock`/`ownLocked` (canvas/locks.ts): a locked element, or one inside a locked
  container, no longer moves on drag; a free element whose own layer is locked no longer
  moves, resizes or rotates as a tile. Frames and image nodes have no lock: there is no
  node-level flag, and adding one is a schema change left for later.
- **#20** `altCopies` (canvas/alt-copy.ts): Alt-drag of an element inside a frame drags
  copies (via `duplicateLayer`, so a stack child's copy lands next to it) and selects them;
  the original stays. An Alt-drag that leaves the frame commits the copy inside it instead
  of carrying it out.
- **#12** a free element's Layers row takes hidden/locked from its own layer, so it dims and
  shows eye/lock when held, with working toggles while the element is open. Clip rows
  already had them on hover.
- **#19** Run flow is offered only when the selection holds a generating node. The combined
  bounding box with handles for several tiles, and the inspector for them, are not done:
  they sit on the free-element resize model being reworked in parallel.
- **#11** hiding frames/images/groups as tiles needs the same node-level flag as lock: not
  done.
