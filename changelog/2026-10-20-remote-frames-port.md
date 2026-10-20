# Server frames fall back to the remote renderer

`POST /api/v1/motion/:id/frames` (CLI `motion frames`, MCP `view_motion_frames`) answered `server_frames_unavailable` on any server without Chromium. PR #1005 added the remote fallback only to `view` -> `snapshot`; the two copies of the decision were separate.

Now one function, `remoteFramesWhenClosed` (`edit/frames-source.ts`), is used by both: local Chromium if open, else the renderer at `REMOTE_RENDER_URL` (default `https://oh.feega.app`, `off` disables), forwarding node id, times, width and the caller bearer. The remote reads the SAVED doc: unsaved local edits are not drawn.

Not switched: in-server agent paths (`turn.ts`, `tool-run.ts` frames, `export_selection`, `export_image`, canvas export action). They hold no caller bearer to forward, and the remote has no export endpoint. They still answer closed.
