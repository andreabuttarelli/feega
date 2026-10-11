# update_components replaces patch_component

The motion agent's partial-edit tool is now `update_components({ component, edits: [{ file, find, replace, occurrence? }] })`.

- `occurrence` (`first` | `last` | `all`) is optional. Absent, `find` must occur exactly once, as before; present, ambiguity is allowed. A missing `find` is always an error.
- Same path as `write_component`: `updateComponent` (`src/lib/motion/custom/ops.ts`) ends in `writeComponent` (lint, props extraction); the tool runs `codeWrite` (turn budget, determinism check).
- Returns `diff`: per edit, file, count replaced, the line before and after (160 chars max).
- `patch_component` removed, not aliased: two tools for one job split the model's choice. The new tool is in `toolsWritingCode`, so the step routes to the code model.
- CLI and MCP expose no component tools directly; they reach it through the motion agent, so nothing changes there.
