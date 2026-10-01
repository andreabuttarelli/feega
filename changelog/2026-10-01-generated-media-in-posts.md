# Generated media in posts, effects connections, dubbed video in share

Three defects, one cause in common: code reading node payloads that generation no longer writes.

- **Promote / calendar `create_post`** read `data.output_asset_id` and `status === 'done'`. Generation
  writes `refId`, `running`, `error` (and audio `outputRefs.{videos,audios}`): every post made from a
  generated node had no media. One resolver now, `src/lib/canvas/node-media.ts::nodeMediaAsset`, a
  table per node type, used by `post-from-nodes.ts` (server) and `post-composition.ts` (composer).
  A dubbed audio node gives its video; a running node gives nothing.
- **Effects connections**: `canvasNodeOf` (`node-model.ts`) mapped only "medium" types and turned
  every other row into `iframe`, so `connectVerdict` refused every edge into `effects` (and
  `composition`). It now maps every `NODE_KINDS` type, and passes an effects node's `mediaKind`.
- **Shared view `/s/[token]`**: an audio node signed only `refId`. The view now carries
  `videoUrl` + `audioUrl` from `audioOutputIds` (same rule as the canvas) and renders `AudioResult`.

Discarded: keeping `output_asset_id` as a fallback — nothing writes it on `nodes.data`.
