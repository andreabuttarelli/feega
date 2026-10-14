# Canvas CRUD over MCP and CLI, loops in the project chat

The project chat could list, create, update, move, connect, delete and run nodes; MCP reached the
same tables only through `insert_row`/`update_row`, which skip the chat's checks (model refusals,
uncensored targets, edge media, patch merge). The CLI had nothing.

The ops moved out of `project-tools.ts` into `canvas/canvas-ops.ts`: one table of input schema,
access (read, write, spend) and run. The chat tools wrap it; `POST /api/v1/org/canvas`
(`{ project_id, op, input }`) runs the same rows, gating write by key scope and spend by
`gateOrgAiAction`; MCP gets one `canvas_tool` (49 tools, one more instead of nine), the CLI
`feega canvas <projectId> <op> --input <json>`.

The loop ops (`preview_node_loop`, `run_node_loop`, `cancel_node_loop`) MCP already had are rows
of the same table, so the chat now has them too. Discarded: nine MCP tools, one per op — the
list costs every session.
