# Agents see the same model catalogue as the picker

The canvas picker already grouped models by provider and badged uncensored ones. What was missing:

- `list_models {medium}`, a canvas op, so the project chat (`canvas_tool`) and MCP (`canvas_tool`)
  read the catalogue the picker reads: one function, `projectCatalogue` (`project-catalogue.ts`),
  now also builds the canvas page's catalogue. Each model: id, provider, credits (null when the
  price depends on the input), uncensored flag, inputs, resolutions, durations, and `routedVia`
  when a cheaper route (kie.ai) runs it first. CLI: `feega canvas models <projectId> [--medium]`.
  The motion agent has no model-choosing tool, so nothing to add there.
- `offerableIn` hides a model by its `uncensored` flag, not only by the `wiro/` prefix: an
  uncensored Higgsfield or kie model would have shown in a standard project.
- The picker shows "via kie.ai" next to a price that comes from the discount route.
- `run_node_generation` (MCP) and `run_node` (chat) descriptions name the providers, the
  discount route and `list_models`.

Kept as an op of `canvas_tool` rather than a top-level chat tool: the chat's tool surface is
counted (`tool-surface.test.ts`) and a read nobody needs every turn does not earn a slot.
