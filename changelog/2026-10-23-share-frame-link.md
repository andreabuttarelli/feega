# Share link per frame

The viewer page (`/s/[token]/[frame]`) had no way to be reached except by assembling the URL by
hand from the canvas share token and a published embed.

- `src/lib/server/motion/agent-share.ts`: `frameLink` (embed must already be published; mints or
  reuses the canvas share token; refuses projects whose mode may not share) and `shareMotionFrame`
  (publishes the embed first when it is not, never rebuilds one that exists, so a client-built
  embed with its settings is not overwritten). New failure `embed_not_published`, 409.
- App: `EmbedView` (export dialog, published state) gets "Copy viewer link" ->
  `POST /p/[projectId]/c/[canvasId]/motion/[nodeId]/share` -> `frameLink`.
- API: `POST /api/v1/motion/[nodeId]/share` -> `shareMotionFrame`. CLI `feega motion share
  <nodeId>`, MCP `share_motion_frame`; skill, tool docs and the tool-list pin updated.
- Status mapping of embed answers moved to `embedStatus` in `agent-embed.ts`, shared by the
  embed and share routes (reordering only).
- Turning the canvas share off still kills every frame link: one token per canvas, no migration.

Not done: the in-app chat agent has no `share_motion_frame` row. `tool-surface-pin` and the
chat-path eval rule make that a separate change.
