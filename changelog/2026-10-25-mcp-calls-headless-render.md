# MCP calls: batch target, canvas project, compact polls, headless render

**Before** (two external-agent evals, 2026-10-24): a batch ignored a top-level `target`
(`target_required` per step); `draw_frame` with a `canvasId` still asked for `project_id`;
a refused batch answered `failed: 0` or `failed: 2`, an index that read like a count;
`get_render` polls carried ~2.3 KB twice (text + structuredContent); `view` documented
`snapshot {node_id}` while the call is `{op, input: {node_id}}`; `update_components` echoed only
the first line of a multi-line edit; `write_component` hid the `param()` signature, the
`--param-*` css vars and the house eases in the source; the free browser render needed a click
on `render-start`, so an MCP-only agent could not export.

**Now:** `runEdit` takes `target` for steps without one, and finds the project of a canvas op
from `input.canvasId` (`canvasProject`). A refused batch answers `failed: 1`, `failed_at`,
`rolled_back` (steps of the atomic frame group undone) and `not_run`. `get_render` answers
`{status, asset_id?, file_url?, error?}`, text only. The diff spans every line the edit touched.
`PARAM_GUIDE` (next to `PARAM_TYPES`) carries the signature and an example into the tool
description. The render answer carries `headless_url` (`?autostart=1`): the render page starts
on load; the quickstart shows a headless Chromium one-liner and a "custom visuals" flow.

**Not done here:** a server-side free render (needs the GPU/browser farm), the component check
recorded on export, storage purge when a project row is hard-deleted.
