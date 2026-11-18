# One link per page, component links, before thumbnail

Before: an import landed one frame holding several pages, and `frame_code_links` was keyed by `node_id`, so only the first page was linked; `files` held only the other page files.

Now the link is keyed by `(node_id, entry_key)` (`linkKey`: kind, role, route, entry). An import saves one page link per route with the full import graph in `files` (`import-graph.ts`: relative and `@/`/`~/` imports, index files), one `main` link per library component reached, and one `instance` link per page using it. `read` still returns the first page link, so push, status and undo keep working; pushed state and rebase apply to every link of the node.

Keyed by node + entry rather than one frame per route: a frame already holds one board per route from a single capture; splitting into N frames means N captures or reworking the import pipeline. One frame per route stays the direction for design-in-codebase, and this key makes that move a data change, not a schema one.

`before_poster`: first poster saved after import (`savePoster` -> `keepBeforePoster`), shown next to the current poster in Changes rows.

Migration `20261117180000_frame_code_links_per_entry.sql`, not applied in prod.
