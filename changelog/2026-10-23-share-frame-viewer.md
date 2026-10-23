# Shared frame viewer

A shared canvas link opened the whole canvas; a motion frame could only leave as a web embed.
There was no page to send someone "just this frame", and none that worked on a phone.

- `/s/[token]/[frame]` (`src/routes/s/[token]/[frame]/`): clean viewer of one motion frame. The
  token is the canvas share token, so revoking the canvas link kills every frame link; the frame
  must be a live motion node of that canvas whose embed is published (`readSharedFrame` in
  `src/lib/server/canvas/frame-share.ts`). No migration: the embed lives in the `embeds` bucket,
  the token in `canvases.share_token`. Nothing else of the canvas is exposed.
- The page frames `/e/<frame>?fit=contain` (the hosted embed player), so playback, loop and
  interactivity follow the frame's own settings. Tap toggles play/pause through the host
  messages; play state is read from the player's `timeupdate`.
- Phone: full-bleed, safe-area aware, swipe left/right moves to the previous/next published frame
  of the canvas (canvas order, top to bottom). Arrows and Left/Right keys on desktop.
  Gesture rules are pure (`src/lib/canvas/frame-viewer.ts`).
- Checked in Chromium, desktop and iPhone 15 viewport, with a CDP touch swipe
  (`tests/e2e/share-frame.spec.ts`, shots `~/Documents/feega-videos/e2e/share-frame-*.png`).

Next: link creation from the app, CLI and MCP; duplicate to workspace.
