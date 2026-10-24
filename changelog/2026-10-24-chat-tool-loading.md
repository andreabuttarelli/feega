# Canvas chat loads frame tools

Plan `one-chat-agent.md` §8, steps 3–4. Before: the canvas chat reached the 189 frame editor
tools only through the `frame_tool` proxy (`list_frame_tools` → `describe_frame_tool` →
`frame_tool`), schema in a tool result, three calls per new tool.

- `project-agent/tool-loading.ts`: every frame tool is registered as a direct tool (its real
  schema plus `node_id`), filtered by `activeTools` in `prepareStep` = core ∪ loaded.
  `find_tools` (keyword score on name and description) and `load_tools` (several names, callable
  from the next step) are in the core.
- Warm set per thread derived from history, no migration: frame tools used in the last 3
  replies (proxy calls included) start loaded. Cap 40, least recently loaded drops.
- `TOOL_LOADING=proxy|direct|load` (server env, default `load`) keeps the old surface and an
  all-direct one for `npm run eval:tool-loading`, which compares the three.
- Budget test: core cap (`CORE_MAX_CHARS`) and loaded cap replace `CANVAS_CHAT_MAX_CHARS`.
- Spawned sub-agents get the core, not the frame tools.
- Core shrunk to 3.7k chars, 11 tools (was 28k, 43 tools; budget `CORE_MAX_CHARS` 8k, each tool
  under 600). `project-agent/core-tools.ts` is the table: `CORE_LINES` names the tools that stay
  and their one-line description; their schema is sent without descriptions, nested objects or
  long enums, and the original schema still validates the call. Every other project tool
  (connect_nodes, effects, gallery, groups, loops, move_node...) is found with `find_tools` and
  loaded with `load_tools` like a frame tool. `describe_tools` gives the exact schema of any tool.
- Web tools and spawn_agent are passed as `kept` and stay offered; they are not in the measured
  core (the budget test builds project + motion tools only).
- MCP unchanged (`edit` + `describe`).
