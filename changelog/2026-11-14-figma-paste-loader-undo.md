# Figma paste: in-place loader and optimistic undo

Before: `pasteFigma` awaited the `pasteFigma` action, then pushed the server undo
gesture. Nothing showed while it loaded, and Ctrl/Cmd+Z did nothing until the
import answered (seconds), because the undo entry did not exist yet.

Now `src/lib/canvas/figma/paste-job.ts` models one paste (loading, landed,
failed, cancelled, undone). The page pushes a `figma` undo entry in the same
frame as the paste and draws a placeholder at the paste point (`canvasOver`).
Undo while loading cancels the job; a late answer is deleted on the server
through the regular `undo` action and never shown. Undo after landing removes
the tiles locally first, then reconciles with `undo` in background; redo puts
the tiles back and replays the server redo gesture.

Not a `REGISTRY` row: the nodes are created server-side from Figma HTML, ids
unknown until the answer, so `createOptimistic` (apply locally, then write)
does not fit; the job holds the placeholder instead.
