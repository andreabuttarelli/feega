# A signed storage URL was persisted into `nodes.data` and later expired

Three drag-and-drop write paths — `assetDrag`, `brandFieldDrag`, `colourDrag`
(`src/lib/canvas/drag-payload.ts`) — built a static `image`/`video` node via
`staticMediaData`, and that helper wrote the *signed* URL (valid ~2 hours on Supabase
Storage) straight into `nodes.data.url`. The node never carried `refId`, so the load
path that re-signs on every read (`GenNode`'s `refId` → `/p/<project>/c/<canvas>/assets/<id>`)
never applied to these nodes. Once the signed URL expired, the image silently
disappeared from the canvas — the file was fine in Storage the whole time.

The upload path (`registerCanvasUpload`, `src/lib/server/canvas/upload.ts`) already did
this correctly: it writes the stable internal route (`/p/<project>/c/<canvasId>/assets/<assetId>`)
as `url`, never a signed one. The drag-and-drop paths were the outlier.

## What changed

- `staticMediaData` (`src/lib/canvas/drag-payload.ts`) no longer accepts/writes `url`
  into persisted node data — only `assetId`, `name`, `mimeType`, `prompt: ''`. The
  three call sites (`assetDrag`, `brandFieldDrag`, `colourDrag`) still take a signed
  URL as input (to confirm the asset is real before creating the node) but discard it
  before persisting.
- Render side: `UploadedNode` on the canvas page now builds its `src` from the stable
  `assetUrl(assetId)` route instead of trusting `node.data.url` — the same pattern
  `GenNode` already used for `refId`.
- Load tolerance: `genOf` (`src/lib/canvas-node-data.ts`) now falls back to
  `data.assetId` when `data.refId` is absent, so already-broken rows (assetId, no
  refId) render immediately without a backfill being a hard requirement.
- `validateNodeData` (`src/lib/canvas/node-data.ts`) now rejects any node data
  containing a Supabase signed-storage-URL pattern (`/storage/v1/object/sign/`),
  recursively, anywhere in the payload — this closes the write boundary for every
  future write path (app, CLI, MCP `insert_row`/`update_row`), not just the three
  fixed here.

## Backfill

`scripts/backfill-signed-url-nodes.ts` — one-off, service-role, targets rows where
`data->>assetId` is present, `data->>refId` is absent, and `data->>url` matches the
signed-storage pattern (the reliable signature of this bug regardless of expiry).
Dry-run by default; `--apply` writes `refId = assetId`, drops `url`, under an
optimistic-concurrency `version` check per row.

## Decisions

Kept `libraryMedia.url` optional in the zod schema (`src/lib/canvas/node-data.ts`)
rather than removing the field outright — old rows may still carry it during the
backfill window, and the new `validateNodeData` guard is what actually prevents a
*signed* URL from landing there again, not the shape.

Did not add a second resolution mechanism for `assetId` at load time — reused the
existing `refId` fallback path (`nullableStr ?? nullableStr`) instead of inventing a
parallel signing call.
