# Canvas comments, wired

The table (`20261018140000_canvas_comments.sql`, applied) had no code. Now:

`canvas-comments.ts` lists threads, adds a comment or reply, resolves/reopens a thread;
`comment-threads.ts` holds the pure part (grouping, numbering, body limits). Page actions
`canvasComments` / `addComment` / `resolveComment` and the canvas ops `list_canvas_comments`,
`add_canvas_comment`, `resolve_canvas_comment` (MCP parity, tool pins updated on purpose).

UI: "Comments" in the canvas menu opens `CanvasCommentsPanel`. A new comment pins to the
selected node (x/y relative to its top-right) or, with nothing selected, to the middle of the
view in canvas coordinates. Pins draw through `tileOver` (node) and a new `canvasOver` snippet in
`GpuFlow`, which now exposes `--zoom` so a pin keeps its size. Resolved threads leave the canvas
and show under "Show resolved".

Left out: realtime (the table is not in the publication, the panel reloads after each action),
editing and deleting a comment, placing a pin by clicking the canvas. `database.types.ts` was not
regenerated (no access token here): the repo reaches the table through a narrow typed view, as
canvas versions do.

`tests/e2e/canvas-comments.spec.ts` covers add, node pin, reply, resolve.
