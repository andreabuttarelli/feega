# UI → MCP parity table

Rule: every change a person makes on the canvas or inside a frame must be reachable by an
external agent over MCP. Nothing checked it; the canvas page had ~50 form actions and MCP covered
about a third.

`src/lib/server/parity/ui-actions.ts` maps every UI mutation to its MCP route (`canvas_tool` op,
`motion_tool` tool, or a named MCP tool), or marks it `uiOnly` (view state, clipboard,
onboarding) or `gap`, each with a reason. `parity.test.ts` scans the form actions of the canvas
and frame editor pages, the editor command registry (`ACTIONS`) and the selection toolbar, and
fails when one is not in the table, when a route does not exist (canvas ops, motion tool list,
`docs/mcp-tools.md`), or when the gap list changes. Typed `Record`s over `LayerAction`,
`CanvasAction`, `ClipOp`, `EmptyAction` fail at compile time instead.

Inline route logic moved into server functions first (pure move: `node-writes.ts`,
`node-sync.ts`, `retryLoopCombo`, `workflowCredits`), then new `canvas_tool` ops call them:
canvas CRUD, rename project, connections list/disconnect/mode, resize, duplicate, share canvas
and doc, canvas templates, frame from template, show an older run, sync, loop retry, workflows,
cancel render, withdraw from gallery. Motion tools gained `split_clip`, `duplicate_clip` (via
`runClipOp`, what the editor buttons call) and `delete_template`.

Fixed: MCP `delete_node` left the node's lines alive; it now goes through `removeNodes` like the
canvas Delete.

Gaps left (frozen in the test): custom voices, binary upload to a canvas node, posts/calendar
(being retired), server farm render over the API. The project chat agent does not expose the new
ops yet; the frame agent gets the new motion tools automatically. Field-level frame edits stay
covered by `motion-agent-parity.test.ts` (every doc field has a write tool).
