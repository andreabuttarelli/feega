# batchWrite and paste have an /api/v1 op

Step 1 of moving the canvas page actions to `/api/v1`, so a static native build (ADR 0009,
option d), the CLI and MCP share one API. `batchWrite` and `paste` had their logic inline in
`+page.server.ts`; the parity table pointed them at `update_node` and `create_node`, which do not
do the same thing (per-item version merge; nodes plus edges wired by index).

The bodies moved verbatim to `writeNodesBatch` (`server/canvas/batch-write.ts`) and `pasteNodes`
(`server/canvas/paste.ts`). The form actions and the new CANVAS_OPS `write_nodes` and
`paste_nodes` call them. `api-parity.test.ts` proves action and endpoint answer the same.

The web client still calls the form actions; switching its transport is a later PR. The ops act
as `agent` like every other op, the actions as `user`.
