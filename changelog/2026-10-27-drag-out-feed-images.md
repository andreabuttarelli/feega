# Drag a picture out of a feed or a products node

A social feed or products node showed its thumbnails and nothing else. To use one, the user saved
the file by hand and uploaded it again. Source urls are social and store CDNs, which expire and
block hotlinking, so a node pointing at them would break later.

- `SourcePreview.svelte`: each thumbnail is draggable (`nodrag`, so the parent node neither moves
  nor pans), carrying `CANVAS_DRAG_FEED_IMAGE` with node id, item id and picture index. Only the
  selected node is a DOM node on the core canvas, so the node is selected first.
- `GpuFlow.svelte` takes the new mime on dragover/drop and hands it to the page
  (`onFeedImageOver`, `onDropFeedImage`); the page shows a dashed box at the drop point and the
  frame under the pointer, then a placeholder (`pendingPicture`) while the copy runs.
- Action `importFeedImage` -> `feed-image.ts::importFeedImage`: the server resolves the url from
  its own rows (the client sends ids, never a url), fetches it with `safeFetchBytes`, stores it in
  `canvas-assets` under `${orgId}/${projectId}/`, inserts the `assets` row and creates the `image`
  node through `registerCanvasUpload`, with the id of the placeholder. Size follows the decoded
  picture, long side 360. Provenance sits in `data.source` (kind, node, item, external id, picture
  url, page url).
- Dropped inside a frame, the same call goes through `placeMedia`, as an image dropped there.
- Agents: op `import_feed_image` (`canvas_tool`), parity row, docs, skill references, snapshot.

Discarded: a client-sent url (open fetch for any caller); dragging from a node that is not selected
(needs a hit test in gpu-core, owned elsewhere); video posts give their poster, not the video.
