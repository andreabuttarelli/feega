# MCP agents see node media: `get_media`

**Why.** An external agent ran `run_node_generation` (seedream, 1366×2048) and could read only
the asset row: `assets.url` is a path in a private bucket, so it could neither look at the image
nor judge it against the prompt. Same for media already in nodes.

**What.**
- `GET /api/v1/org/media?node=…&run=…&asset=…` (`src/routes/api/v1/org/media/+server.ts`):
  Bearer via `resolveOrgCaller`, reads with the caller's db filtered by `org_id`, then signs with
  the declared `sign-media` service-role client. Nothing visible → 404 with `missing`.
- `loadMedia` (`src/lib/server/canvas/node-media.ts`): node → `data.refId`/`assetId`, run →
  `output_asset_id`, asset direct. Bucket by `source` in one table (`generated` →
  `brand-knowledge`, else `canvas-assets`); preview only for images.
- Two links per item: `previewUrl` (storage transform, 1024px box `contain`, q80, signed with the
  single `createSignedUrl` — the batch call ignores `transform`) for the agent to look at, and
  `fullUrl` for the user. 300 s TTL.
- MCP `get_media`; `run_node_generation` now returns `asset_ids` and `media` (same links). CLI
  `feega media --node/--run/--asset`.

**Discarded.** Inline base64 image content blocks: first built, dropped on request — links keep
responses small and the client decides when to fetch. Video posters: no poster is stored today,
so videos get `fullUrl` only; transcoding a frame was out of scope.

**Verified.** Local MCP HTTP → dev server (port 5195) with two disposable orgs: own node+asset
came back with both links (preview 683×1024, full 1366×2048 PNG); the other org's ids → 404.
