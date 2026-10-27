# Compare two versions of a generation, see what changed, pin one

Gap T11 of the AE/Flora parity list. The history popover of an image node could only pin a past
version (`restore` -> `show_run`, which sets `refId`; downstream reruns read `refId`).

- History popover: `Compare` picks two image versions, opens the existing slider overlay with a
  table of what differs (prompt, model, settings) from `node_runs.params`.
- `diffRuns` (`src/lib/canvas/run-diff.ts`) is the single diff, used by UI and by the new
  `compare_runs` op (`canvas-ops.ts`), so chat, `edit` and MCP `canvas_tool` get it too.
- `list_runs` already returns every version with params; `show_run` is now described as the pin.
- Discarded: a separate `pin_run` op (would duplicate `show_run`), a video/text slider (the
  slider is image-only).
