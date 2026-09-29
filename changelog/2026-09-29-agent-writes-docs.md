# Agent writes text the canvas can show

Production: "Add a text node with three hook ideas" → `create_node`
`{type:'text', data:{content}}`. `create_node` never validated `data`,
stored it as sent and echoed success; `text` has no `content` (its body is
generated output), so the node rendered empty.

- `create_node` validates with `validateNewNodeData`: unknown fields and
  missing required ones return `{ outcome: 'invalid', message }` naming the
  allowed fields; `content` carries a hint toward `doc`. It stores and
  returns the parsed data.
- `update_node` refuses patch fields the node type does not have.
- MCP `insert_row` on `nodes` uses the same strict check (unknown keys were
  stripped by zod). `update_row` stays lenient: `refId`/runtime keys are not
  in the schemas and existing writers set them.
- New project tool `describe_node_types`; prompt and `create_node`
  description say written text goes in `doc { content, public: false }`.
  Removed the prompt line claiming `update_node` replaces all data (false).
- Discarded: storing agent text as a text asset + `refId` on a `text` node —
  needs an asset write path for the agent and fakes a generation.
- One-off repair: node `6ab574fd-…` converted to `doc` via SQL
  (`version = 1` guard), content kept.
