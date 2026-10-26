# Delete on a free element deletes the node

Selecting a free element auto-picks its own clip, so Delete ran the in-frame clip
delete and left an empty `kind: element` node that looked like an empty frame.
`deletePicks` now asks `leftEmpty(kind, doc)` (moved from `move-element.ts` to
`motion-node.ts`, keyed on `CHROME.takesDrops`) and drops the node instead of saving
an empty doc. One undo step restores it. Stopgap: the root fix is the first-class
`element` node. E2E: `tests/e2e/canvas-free-delete.spec.ts`.
