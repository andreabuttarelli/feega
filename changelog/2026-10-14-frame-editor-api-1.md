# Frame editor actions over `/api/v1/motion/{node}/ops` (1/n)

ADR 0009 option (d) needs every frame editor action reachable without the SvelteKit form
actions. The audit read each action against what CLI/MCP already call: `save`, `ops`, `head`,
`renderStatus` and `batchStatus` had no API that runs the same function (`motion_tool` commits a
tool's result, `get_motion_summary` returns a digest, `get_render` reads one run by id).

`src/lib/server/frame-editor/editor-ops.ts` holds one registry, `EDITOR_OPS`, with `read_head`,
`save_doc`, `apply_ops`, `render_status`, `batch_status`. The page actions and the new endpoint
both call `runEditorOp`, so status and body match (`api-parity.test.ts` checks it on one fake DB).
The endpoint scopes the node through `callerMotionScope`: org, canvas and the uncensored lock,
the same checks `motionScope` makes for the page. Spending ops will gate through `ctx.gate`,
given by each caller (form gate for the page, API-key gate for the endpoint).

The registry lives outside `src/lib/server/motion/` because `motion-tool-references.test.ts`
reads every tool-shaped name there as a motion agent tool.

MCP `motion_editor_op`, CLI `feega motion op <nodeId> <op> --input json`. The web client still
uses the form actions.
