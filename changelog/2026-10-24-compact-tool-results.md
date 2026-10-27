# Compact tool results (MCP and in-app chat)

**Before:** an edit or write answered with the whole document it touched (node `data`, frame doc,
base64). A single `update_row` on a node was ~24k chars; a batch of 12 moves ~250k. Every turn
carried that back into the model's context. `query` read 20 rows, 2k chars per value, 60k total.

**Now:** `src/lib/server/edit/compact-result.ts` shrinks a write answer to ids, version, status and
the fields the call sent; other columns are dropped, long values become `[N chars, ask verbose…]`,
arrays cap at 20, signed links stay whole. Answers say `trimmed: true` when something was cut.
`verbose: true` returns the original on `edit`, `insert_row`, `update_row`, `query` and the chat's
frame `run` tool.

- Wired in: `runEdit` (MCP `edit`, writes only, not spend, not reads), `insert_row`/`update_row`,
  chat `canvas_tool` and own op tools (Access.Write only), chat frame tool.
- `query`: 10 rows by default, values cut at 500, 12k per page; `next_cursor` / `cursor` replace
  hand-computed offsets (`offset` still works); `verbose` restores the old caps.
- Discarded: compacting spend ops (their result IS the content), compacting reads other than
  `query` (an agent reading a node wants it whole).
- Frame ops are all `write` in the catalogue, so a frame read through `edit` is compacted too:
  pass `verbose`.
- Test budget: `compact-result.test.ts` prints before/after for 10 representative answers and
  holds a typical single edit under 500 chars.
- Pins moved on purpose (`-u`): MCP list fingerprint and chat `canvas_tool` definition, both gained
  one optional `verbose` field.
