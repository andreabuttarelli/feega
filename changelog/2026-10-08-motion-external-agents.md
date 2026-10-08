# Motion videos for external agents (API, CLI, MCP)

## Why

An external agent could already ask the motion editor agent (`/api/v1/motion/[nodeId]/ask`) and
render (`/render`, `/renders/[runId]`), but could not find a node id, could not publish the web
embed, and could not download the self-contained HTML. Hosting the embed lived only behind the
editor's session route and the editor agent's `publish_embed` tool.

## What

- `GET /api/v1/motion?project=` → `listMotionVideos` (`agent-videos.ts`) → `listMotionNodes`
  (`repos/canvas.ts`): node id, revision, signed poster / last render.
- `GET|POST|DELETE /api/v1/motion/[nodeId]/embed` and `GET .../embed/bundle` →
  `agent-embed.ts` → `publishEmbed` / `removeEmbed` / `embedPublished` / `interactiveBundle`
  (`embed.ts`, bucket `embeds`). Same uncensored refusal (403 + `refusal`); empty video 409.
  Free, so no credit gate; read-only keys can read state and download, not publish.
- CLI: `feega motion list`, `feega motion embed [--unpublish|--status|--download f]`,
  `render --quality --fps`.
- MCP: `list_motion_videos`, `publish_motion_embed`, `get_motion_embed`; `render_video` takes
  `quality` and `fps`.

## Decisions

- `ask_motion_agent` now returns the run at once by default (`wait: true` opts into polling):
  MCP clients time out long before 4 minutes. The CLI still waits by default.
- The API embed publishes the saved head revision, not an unsaved session doc (the agent tool
  does the latter mid-turn).
- The bundle download is not refused for uncensored projects: the editor's own download isn't.
- Verified end to end on a local dev server against a throwaway org: list, embed publish →
  public `/e/{id}` 200 → state → bundle → unpublish, browser render link, and one real ask turn
  (done, revision 2).
