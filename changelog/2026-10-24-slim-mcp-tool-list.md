# Slim MCP tool list, loaded on demand

**Why.** The external-agent eval (#1285) spent 1.3M input tokens vs 23k for plain Remotion: MCP
clients resend `tools/list` every turn, and ours was 58,299 chars (~14.6k tokens, 54 tools).
14 of 33 calls errored.

**What.** A session lists 10 core tools (`query`, `view`, `edit`, `describe`, `render_video`,
`get_render`, `list_orgs`, `find_tools`, `load_tools`, `unload_tools`): 3,474 chars (~870 tokens),
16.8x less. Listed schemas are compacted (types, enums, required; no prose); the full schema comes
from `describe`. Every other tool keeps working by its old name (unlisted alias), runs through
`edit {op: "<tool>", input}`, and loads per session (`load_tools`, cap 40 LRU, emits
`tools/list_changed`), with the same search and cap as the in-app chat loader (#1277). Edit
catalogue ops (canvas/frame/editor) load too, as direct tools. Validation errors append the tool's
JSON schema; unknown tools point to `find_tools`. Tool results are compact JSON.

`ask_motion_agent` is out of the list, the families and the instructions (user decision):
external agents build with the tools directly. It stays callable for one release; remove after.

**Budgets, enforced by `cli/mcp/slim-surface.test.ts`:** list < 8,000 chars, each listed tool
< 600, each loaded family < 6,000.

**Limits.** HTTP is stateless: loaded tools are keyed by `mcp-session-id` or the Bearer hash,
in-process (best effort on serverless), and no notification can be pushed. Clients that ignore
`list_changed` (Cursor) still reach everything through `edit` or by name.

**Eval.** `scripts/eval/external-agent` saves each arm's transcript, refreshes the tool list on
`list_changed`, and runs `--listing=static|dynamic` (`npm run eval:external-agent:static`,
`:dynamic`). Caps: $5 total, $1.5 per arm.

**Measure.** `cd cli && bun run scripts/tool-sizes.ts` prints tools/list per tool, sorted.
