# Generate uses the route just picked

**Before:** the toolbar model/route picker wrote through `batchWrite` without touching local
state until the server answered. A Generate within that window (button, toolbar, keyboard)
read the old `params` from `nodes` and posted them: a Kie.ai pick ran and billed on
OpenRouter. `postAtVersion` only flushed the debounced `saves` queue, not this write.

**Now:** `commonChange` applies its patch locally first and registers the write in
`inFlightWrites` (`node-save.ts`). `run` and every `postAtVersion` wait for it, then `run`
re-reads the node, so the request carries what the quote shows. A failed or conflicting
write refreshes from the server.

**History:** picking a past output wrote `running: false` and the shown run's `runId` on
both client and server, so a run in flight lost its spinner. `shownOutput`
(`gen-history.ts`) is the single rule: while running, only `refId` changes.

Rejected: making the server re-read the DB row (it already honours the posted params; the
row was the stale side).

**Enter on a control:** the canvas `enter` shortcut swallowed Enter on a focused Generate
button, so the keyboard could not run a node. `matchCanvasShortcut` now leaves Enter and
Space to any focused control (button, link, role=button, checkbox…). Other keys still reach
the canvas: blocking Delete or arrows whenever a toolbar button kept focus after a click
would break them.
