# Upscaler page redesign

Before: one column of small sections ("1 · Clip", "2 · Size and mode"), no drag and drop, no
history, a single "Upscaling…" line while running.

Now `/app/upscale` has a mega lowercase title, a drop zone (drag or click), a source preview
with probe facts, a side panel (size, mode, output size, credits, balance, one action), the
real steps (`upscaleSteps` in `src/lib/upscale.ts`: uploading → starting → upscaling and
saving), the before/after slider with download, and recent upscales.

- History is read by `recentUpscales` (`src/lib/server/upscale/job.ts`): the upscale nodes
  of the project's `Upscale` canvas, newest row first (`jobsOf`, pure, tested). No new table.
- `UpscaleJobStatus` and `UPSCALE_CANVAS_NAME` moved to `$lib/upscale` so the page can use
  them without importing `$lib/server`; the server modules re-export them.
- Discarded: a separate "saving" step. The node's `running` flag covers both upscaling and
  saving; a step the server cannot observe would be invented.
