# Canvas reloads and stale echoes keep unsent edits

Before: `openCanvas` reran on every `data.nodes` change and replaced
every tile with the server row, wiping unsent fields and boxes on screen.
A realtime echo of an earlier own save (the tab had typed further) was
not recognised and forced a full snapshot refresh.

Now `keepPending` (place-save.ts) merges loaded rows field-wise, keeping
dirty data keys and unsent boxes, and is used by both `openCanvas` and
`refresh`. `isOwnEcho` also ignores a row whose version is older than the
tile's, at the same place: the tab already holds something newer.

Not done here: expired signed URLs still swap media items in `keepSame`;
edges are still replaced wholesale (they move to the op queue in D).
