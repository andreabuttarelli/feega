# Stack names for the agent tools, and stack codegen

App → CLI → MCP: the editor says Stack, so the motion tools do too.

- `add_auto_layout` → `wrap_in_stack`, `set_auto_layout` → `set_stack`, `reorder_auto_layout` →
  `reorder_stack`, `leave_auto_layout` → `leave_stack`. The old names stay one release as aliases
  (`RENAMED_TOOLS` in `motion-tools.ts`, one row per rename), their description starts with
  "Deprecated: use …" so an agent reading the list moves over. Remove the table next release.
- `set_stack` documents `align: stretch`; `off` keeps the container, `remove_stack` unwraps.
- Motion prompt, showcase parity list, UI parity rows, `docs/mcp-tools.md`, the CLI tool
  descriptions and skills now say Stack. Canvas op `stack_elements` is listed for MCP.
- Codegen: the Tailwind target mapped `align-items: stretch` to an arbitrary value; it is
  `items-stretch` now. Tests pin that a Stack exports as flex with direction, gap and stretch on
  React, HTML and Svelte.
