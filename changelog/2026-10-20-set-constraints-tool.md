# set_constraints tool

Constraints (2026-10-18) were writable only through `set_layout_item`, one clip
at a time. `set_constraints` takes `clip_ids` plus `horizontal`/`vertical` and
calls `setConstraints` directly, so chat and MCP can pin several layers at once.
Pure rules, resize paths and the inspector are unchanged.
