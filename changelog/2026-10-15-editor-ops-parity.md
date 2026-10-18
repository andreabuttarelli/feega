# Frame editor ops answer like the page

The native bundle runs the frame editor client-only on `/api/v1`. Eight page
actions called the same functions as the API but answered differently, so a
client could not switch without changing behaviour.

- New ops in `EDITOR_OPS`: `list_revisions`, `restore_revision`, `export_still`,
  `start_render`, `cancel_render`, `delete_template`, `publish_gallery`,
  `withdraw_gallery`. The page actions now delegate to them.
- Convention shared with the canvas API: errors are HTTP status codes with
  `{ error }`, success is 200 with the page's body. No 200-with-error.
- `save` with `{"tracks":3}` threw in `withClips`; it now answers 400.
- The older `/api/v1/motion/[nodeId]/revisions` and `/render` endpoints the CLI
  calls are unchanged.
