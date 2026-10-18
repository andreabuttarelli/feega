# Motion tools: batch in one revision, real HTTP errors

Building a page through `POST /api/v1/motion/:node/tools` took ~500 calls, each loading the doc,
assets and tokens and writing its own revision. `tool: "batch"` with `{ ops: [...] }` (max 500)
prepares once, runs every op on one session and commits one revision; the first refused, invalid
or blocked op aborts the whole batch and answers with its `index`.

A tool answering `{ ok: false }` used to come back as HTTP 200; it is now 422
`{ error: "tool_refused", detail }`. Agents in the chat (`frame-tools`) still see the raw output.

`runMotionTool` was split into `prepare` / `execute` / `commit` so the single and batch paths share
them. MCP description and the feega skill name batch as the default for building.

Not done: per-op coalescing for the editor's own save path and idle checkpoints.
