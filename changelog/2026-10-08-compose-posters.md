# Compositions get real posters

PR #273 made /app/compose cards static posters read from `posterAssetId`, but nothing wrote it:
every user composition showed "No preview yet".

- Both editors (motion editor and /app/compose/[nodeId]) capture a 480px JPEG at 40% of the
  duration with `MotionPreview.still` whenever the saved version changes (user save or agent
  edit), debounced 2.5s, and on open when the node has no poster. No server render.
- `?/poster` (editor) and `/app/compose?/poster` (backfill) go through `savePoster`: file in
  `canvas-assets` under the node's motion folder, `image` asset, `posterAssetId` via
  `patchNodeData` (optimistic version).
- Backfill: a card with a last render but no poster grabs a frame from the mp4 in the browser
  once and stores it.
- Canvas motion node, gallery publish and MCP `list_motion_videos` already read
  `posterAssetId`; they now get one.

Discarded: server-side ffmpeg/render farm for posters (cost, latency). Old posters are not
deleted on replacement.
