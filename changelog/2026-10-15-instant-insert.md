# Instant inserts on the canvas

Before: a frame template showed a grey placeholder, then an empty frame, and its look only after
the browser rendered and captured a poster (~5 s measured). A generated image dropped on the
canvas showed nothing until the action answered and a full snapshot came back (~5.4 s).

Now:
- The tab proposes the node id (uuid). The optimistic tile carries the saved row's id, position,
  name and data (`docHeadRevision: 1`), so the realtime INSERT is recognised by `isOwnEcho` and
  triggers no snapshot; `settle` swaps in the saved row, or rolls back on failure.
- Templates show the catalogue poster (`/component-previews/*.jpg`) at once; no synchronous
  capture. A dropped image shows the source picture.
- Server: the node is created already at revision 1, then one revision insert — no patch
  (read + update + event) and no read-back. Builtin templates skip the org-template query; the
  canvas already resolved by `scopeFor` skips `listCanvases`.
- `placeOutput` reports Server-Timing per store call (`phases.port`).

Discarded: one RPC for node + revision. Two sequential inserts no longer dominate; not worth a
migration on release day.
