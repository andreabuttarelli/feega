# Canvas: the .feega file

Why: an agent can start designing on the self-hosted stack (Docker, no
account) and the user then wants that work in feega.app, with auth and
the team. Nothing carried a canvas between instances.

What: one canvas is one `.feega` file, a zip with `manifest.json`
(format, version, canvas name, source ids), `canvas.json` (nodes with
display name and z, connections with handles and mode, motion heads,
asset rows) and `assets/` (the media bytes).

Decisions:
- Built on its own snapshot, not `versionSnapshot`: versions drop
  `displayName`, handles and edge mode, and a video with start and end
  frames cannot run without `target_handle`.
- Ids are remapped with one pass over every UUID in the canvas JSON
  (`remapIds`), so references nested in `data` and motion docs (parent
  frames, asset ids, `/p/<project>/c/<canvas>/assets/<id>` urls) follow
  without a per-type list. Importing the same file twice gives two
  independent canvases.
- Bytes never go through a function body (4.5 MB on Vercel): the file is
  PUT to a signed upload url under `<orgId>/imports/`, then imported by
  path; export answers a signed download url under `exports/`. The path
  must start with the importer's org, and the upload is removed after.
- Every imported asset lands in `canvas-assets` as `upload`, including
  ones that were `generated` (brand-knowledge is per user).
- A failed import soft-deletes the half-built canvas.
- Dashboard import opens a new project named after the canvas; canvas
  import opens a new canvas in the current project.
- Ops `export_canvas_file`, `request_canvas_import`, `import_canvas_file`
  are `BytesSenders`: the in-app chat does not carry them. CLI:
  `feega canvas save` (not `export`, taken by frame export) and
  `feega canvas import`. MCP: `canvas_file`, refused on the hosted
  server because it reads and writes the caller's disk.

Not done: node runs, comments, versions and branches are not carried.
