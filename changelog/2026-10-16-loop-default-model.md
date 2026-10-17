# Loop default model follows project mode; iterate wires drawn apart

**Defect (prod, #688).** A Generate image node with no `data.model`, a products node wired
`iterate` and an influencer wired `fixed`: all 10 loop tickets failed with
`wiro_requires_uncensored_project`. The report said no `node_runs` existed — wrong: the rows were
there (node `2b785a96…`, 12:49 UTC), all `failed`, `model: null`.

**Cause.** With no model on the node, `resolveNodeModel` picked the `balanced` recommendation of
the global catalogue (`canvasModelCatalogue`), which includes uncensored/Wiro models. In a
standard project `generationRefusal` then refused it. A single click is unaffected because the
client sends the model it shows, picked from `projectCatalogue` (already filtered by mode); the
loop reads the node row server-side and had no such filter. Products, influencer and
`actAtVersion` were not involved.

**Fix.** `resolveModelIn(mode, …)` in `node-model.ts`: an explicit model resolves as before; a
missing one is picked from `catalogueIn(mode, …)`. `runGenNode` and both loop call sites
(`loopCreditsFor`, `runOneCombination`) use it. Test: `loop.products-influencer.test.ts`.

**Iterate wires.** Edges render through `WireEdge.svelte` (edge type `wire`). How a mode looks
lives in one table, `WIRE_MODE_LOOK` in `canvas-edges.ts`: `iterate` gets the class
`wire-iterate` (dashed, `--ui-wire-iterate`, aliased to `--ui-warn`) and a repeat icon at the
midpoint; the edge panel shows the same icon. Test: `wire-edge.test.ts`.
