# No inputs for uncensored models

Before this change an uncensored Wiro node took references the same as any other node: incoming
edges, picked references, first/last frame — `likeness-guard.ts` refused only the ones that could
be a real person, everything else passed straight to Wiro. That is narrower than the product rule:
an uncensored model should take no input of any kind, ever, not just no identifiable face.

Enforced at every layer, one predicate reused everywhere instead of five separate checks:

- **Single source of truth**: `connectorsFor`/`connectorsForNode` (`canvas/connectors.ts`) return
  `[]` when `Modalities.uncensored` is true — no port, of any kind, for any node kind. This one
  change cascades into everything already built on it: `CanvasTile` input handles (UI), the
  server pure resolver `resolveUpstreamInputs` (`upstream-inputs.ts`, both the connector loop and
  `pickedWithin` for chosen references), `connect-selection-plan.ts`, and `orphanedByModelChange`
  used by the model-switch confirmation. No new `if (uncensored)` scattered through those files.
- **UI**: `GenNode.svelte` hides the References picker and shows "Uncensored models don't accept
  references" when the resolved `ModelChoice.uncensored` is true.
- **Switch confirmation**: `needsUncensoredConfirm` (`uncensored-switch.ts`, pure, tested) decides
  whether switching to an uncensored model needs confirmation — only when the node already has
  incoming edges or picked `data.references`. `+page.svelte`'s `commonChange` now opens the app's
  `ConfirmDialog` (not `confirm()`) instead of the existing edge-count `confirm()`, and on confirm
  removes edges through the normal `disconnect()` path and clears references through the normal
  `write()` partial-save path — no parallel deletion code.
- **Connect rules**: `graph.ts::canConnect` refuses any edge into a `CanvasNode` with
  `uncensored: true`, with a readable reason. `tileNode` (`connect-rules.ts`) now carries the flag.
- **Server defense in depth**:
  - `uncensored-access.ts::isUncensoredModel(db, modelId)` is the one `ai_models.uncensored`
    lookup, reused by both write paths below instead of reimplementing the query.
  - `node-model.ts::targetTakesNoInputs` wraps it for a target node id; used by both
    `connect_nodes` (`project-tools.ts`, the in-app agent) and `insert_row` on
    `nodes_connections` (`org-data/write-tool.ts`, the CLI/MCP write surface) — refused before the
    row is ever inserted.
  - `wiro-run.ts::startWiroRun` refuses (`WIRO_REFUSALS.noInputsAllowed`) when the target model is
    uncensored and the request carries any `imageUrls`, a `lastFrameUrl`, or non-empty
    `provenance` — before the likeness guard, before the safety screen, before any network call to
    Wiro. This is the last line: even a hand-crafted request that got past every check above never
    reaches the provider with an image field.
  - `ai-models-sync.ts::modalitiesOf` now returns `uncensored` alongside the modalities it already
    read, so `upstream.ts` can pass it straight into the same `Modalities` shape `connectorsFor`
    already consumes — one query, not two.

Chose confirm-and-clear over a hard refusal on model switch: refusing outright would strand a node
that has legitimate wired inputs from a prior model with no way to switch to an uncensored one
without first hunting down and removing every edge by hand. Confirm-and-clear names exactly what
disappears and does it in one gesture, on one Ctrl+Z.

MCP tool descriptions (`run_node_generation`, `insert_row`) now say the rule up front, so an agent
does not discover it by trial and error.
