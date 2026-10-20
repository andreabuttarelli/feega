# ⌘G / ⇧⌘G change the canvas at once

Before: group and ungroup waited for the server (`groupElements` / `ungroupElement`) and then a
full `refresh()` — ~1.8 s quiet, >8 s under load, nothing on screen meanwhile.

Now the page applies the change to `nodes` first (`src/lib/canvas/optimistic-group.ts`):

- ⌘G draws the group tile over the picks' union, behind them, selected, with a client id; picks
  get `groupId` so they move with it. The server creates the group with that same id
  (`groupAskSchema.id`, `node_id` field), so selection survives the confirm.
- ⇧⌘G releases the members at once and selects them. The group tile stays until the server
  turns its shapes into elements: the client has no doc to lift them from.

Ops go through one ordered queue (`inOrder`) after `places.flush()`, so an ungroup never reaches
the server before the group it undoes, and a move made just before ⌘G is saved first. One
`refresh()` runs when the queue empties; a refusal reconciles to the server's truth.

Found on the way: selecting a motion tile prefetched `/session` even for an unsaved tile (version
0); the 404 stayed cached and double-click could not enter the new group. Selection now uses
`warmMotion`, which already skipped unsaved tiles.

Not done: free elements merged into the group are still separate, clickable tiles until the
confirm lands.
