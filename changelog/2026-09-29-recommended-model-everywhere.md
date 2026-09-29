# One model resolution for every generation entry

Before: the workflow fell back to `DEFAULT_MODEL` (a fixed id per
medium), the loop passed `null` and got `model_required`, the MCP
endpoint ignored the node's saved model and jumped to `balanced`, and
nothing checked a model an agent wrote into `nodes.data`.

Now `pickModel` (`src/lib/canvas/default-models.ts`, pure) decides:
explicit model wins; missing → the catalogue's `balanced` recommendation
for the medium; a model the canvas does not offer → `unknown_model` with
the recommended alternatives (balanced, best, cheapest-good). An empty
catalogue cannot judge, so an explicit model passes.

`resolveNodeModel` (`src/lib/server/canvas/node-model.ts`) feeds it the
live catalogue and is called inside `runGenNode`, so canvas click,
workflow, loop, chat `run_node` and MCP `run_node_generation` share it.
The loop also resolves before its upstream read and cost preview.
`nodeModelError` validates `data.model` on writes: chat `create_node` /
`update_node` and MCP `insert_row` / `update_row` on nodes.

Discarded: validating in each entry point separately (five copies).
