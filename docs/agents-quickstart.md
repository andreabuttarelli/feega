# Agents quickstart

Drive feega from Claude Code, Cursor or Claude Desktop through MCP, or from a terminal with the
`feega` CLI. Both are thin clients of `/api/v1/*`.

Tool names and arguments below come from `cli/mcp/tools/*`, `src/lib/server/canvas/canvas-ops.ts`
and the motion tools in `src/lib/server/motion/motion-tools.ts`. The full generated list is in
[`mcp-tools.md`](mcp-tools.md). Ask the server itself with `edit {op:"describe"}`.

## 1. Connect

### Claude Code

Hosted server (OAuth in the browser on first use):

```bash
claude mcp add --transport http feega https://mcp.feega.app/mcp
```

Local server, reusing the CLI login:

```bash
npm install -g feega-cli && feega login
claude mcp add feega -- feega-mcp
```

### Cursor

`~/.cursor/mcp.json`:

```json
{ "mcpServers": { "feega": { "url": "https://mcp.feega.app/mcp" } } }
```

If your Cursor build fails the OAuth registration, use the local server after `feega login`:

```json
{ "mcpServers": { "feega": { "command": "feega-mcp" } } }
```

### Claude Desktop

Settings, Connectors, add a custom connector with `https://mcp.feega.app/mcp`. Or in
`claude_desktop_config.json`, after `feega login`:

```json
{ "mcpServers": { "feega": { "command": "feega-mcp" } } }
```

### Check it works

Call `list_orgs`, then:

```json
{ "table": "projects", "columns": ["id", "name"], "limit": 5 }
```

(tool `query`). More hosts and the Cursor OAuth caveat: [`cli/docs/mcp.md`](../cli/docs/mcp.md).

## 2. CLI

```bash
npm install -g feega-cli     # or: brew, or the curl installer in cli/README.md
feega login                  # browser flow, session in ~/.config/feega/session.json
feega projects               # project ids
feega canvases <projectId>   # canvas ids
feega canvas op <projectId> draw_frame --input '{"canvasId":"...","x":0,"y":0,"w":1920,"format":"16:9"}'
feega motion ask <frameId> "make the title red"
feega motion render <frameId> --resolution 1080p
feega motion share <frameId>
feega canvas export <projectId> <frameId> --format lottie --out launch.json
```

`feega canvas op` runs any canvas op; `feega motion tool <nodeId> <tool> --input '{...}'` runs any
frame op. Both list their ops when given an unknown name.

## 3. Auth and API keys

| Client | Credential |
|---|---|
| MCP, hosted | OAuth (Dynamic Client Registration), or `Authorization: Bearer <access token>` |
| MCP, local (`feega-mcp`) and CLI | the session from `feega login` |
| REST `/api/v1/*` with curl or your own code | the session JWT, or an API key |

An API key (`feega_live_...`) is created in the app under a project's Settings, API keys, with
`read` or `read` + `write` scope, and is sent as `Authorization: Bearer feega_live_...`. It is
checked in `src/lib/server/cli-auth.ts` for the REST API. **The MCP server and the CLI do not
accept API keys**: `cli/mcp/verify-token.ts` rejects them. For a headless agent run `feega login`
once on the machine, or in CI `feega login --email <email> --password-stdin`.

Tools take an optional `org` when you belong to more than one org.

## 4. Vocabulary

- A **frame** is a canvas node of type `motion`: a video or a still. Its id is the `node_id` of the
  motion tools and the `target` of frame ops.
- **`edit`** changes things. A canvas op (`draw_frame`, `create_node`, `combine_scenes`,
  `export_selection`, `place_in_frame`, `share_canvas`) needs `project_id`. A frame op
  (`set_canvas`, `add_clip`, `set_props`) needs `target` = the frame id and optionally
  `element` = a clip id. `version` refuses a stale write with 409.
- **`view`** reads: `canvas_summary`, `get`, `snapshot`, `activity`.
- Text sizes are shares of the frame height (`0.11` is 119 px on a 1080 frame). Colours are
  `#rrggbb` or `brand.primary|secondary|accent|background|text`.
- Spending: `ask_motion_agent`, `run_node_generation` and `generate_voiceover` use credits. Layout
  ops, `render_video` in browser mode, exports and sharing are free.

## 5. Flows

The five flows build on each other. Ids in `<angle brackets>` come from the previous answer.

### Setup: a project and a canvas

`insert_row`:

```json
{ "table": "projects", "values": { "name": "Launch video", "slug": "launch-video-1" } }
```

`edit`:

```json
{ "op": "create_canvas", "project_id": "<project_id>" }
```

Keep `project_id` and the canvas id. Delete the project later with `delete_row`
`{ "table": "projects", "where": [{ "column": "id", "op": "eq", "value": "<project_id>" }] }`.

### Flow 1: a 3-scene launch video from a URL

Draw three 16:9 frames side by side. Scenes play left to right as placed. Each `draw_frame`
answers `frame_id`.

`edit` (once per frame, x = 0, 2100, 4200):

```json
{ "op": "draw_frame", "project_id": "<project_id>",
  "input": { "canvasId": "<canvas_id>", "x": 0, "y": 0, "w": 1920, "format": "16:9" } }
```

Set each to 3 seconds, one revision per frame, in one call (`edit`):

```json
{ "op": "batch", "project_id": "<project_id>", "ops": [
  { "op": "set_canvas", "target": "<frame_1>", "input": { "duration": 3 } },
  { "op": "set_canvas", "target": "<frame_2>", "input": { "duration": 3 } },
  { "op": "set_canvas", "target": "<frame_3>", "input": { "duration": 3 } } ] }
```

Let the editor agent read the site and design each scene. `ask_motion_agent`, one call per frame
(spends credits):

```json
{ "node_id": "<frame_1>", "wait": true,
  "prompt": "Scene 1 of 3, 3 seconds. Use https://example.com for brand, colours and copy. Hero title only, few words, big type." }
```

```json
{ "node_id": "<frame_2>", "wait": true,
  "prompt": "Scene 2 of 3, 3 seconds. One product UI moment from https://example.com, zoomed on one real element." }
```

```json
{ "node_id": "<frame_3>", "wait": true,
  "prompt": "Scene 3 of 3, 3 seconds. Call to action with the site address, same style as the other scenes." }
```

Look at the result with `view`:

```json
{ "op": "snapshot", "input": { "node_id": "<frame_1>", "time": 1.5 } }
```

If a call returns `running` instead of `done`, poll `get_motion_run` `{ "run_id": "<run_id>" }`.

Without credits, build a scene by hand with frame ops (`edit`):

```json
{ "op": "batch", "project_id": "<project_id>", "ops": [
  { "op": "add_clip", "target": "<frame_1>",
    "input": { "component": "BrandBackground", "start": 0, "duration": 3, "props": { "fill": "#0b0b0f" } } },
  { "op": "add_clip", "target": "<frame_1>",
    "input": { "component": "Title", "start": 0.2, "duration": 2.8,
               "props": { "text": "Ship the\nlaunch video.", "size": 0.12, "color": "#ffffff", "weight": 600 } } } ] }
```

### Flow 2: edit an existing frame's text and colours

Find the frame and its clips. `list_motion_videos` `{}`, then `view`:

```json
{ "op": "canvas_summary", "input": { "canvas_id": "<canvas_id>" } }
```

The answer lists, per frame, every element with its id, kind and text. Read one fully (`id` is the
element, `frame_id` its frame):

```json
{ "op": "get", "input": { "id": "<element_id>", "frame_id": "<frame_1>" } }
```

Change text and colour. `target` is the frame, `element` the clip. `version` is the revision you
read, so a concurrent edit is refused instead of overwritten. `edit`:

```json
{ "op": "set_props", "target": "<frame_1>", "element": "<element_id>", "version": 3,
  "input": { "props": { "text": "Launch day.", "color": "#ff4d00" } } }
```

Several changes in one revision, all or none (`edit`):

```json
{ "op": "batch", "project_id": "<project_id>", "ops": [
  { "op": "set_props", "target": "<frame_1>", "element": "<title_id>", "input": { "props": { "text": "Launch day." } } },
  { "op": "set_props", "target": "<frame_1>", "element": "<background_id>", "input": { "props": { "fill": "#101820" } } } ] }
```

Move a clip with `set_transform` (`x`, `y` offsets in px) and retime it with `set_timing`
(`start`, `duration` in seconds), same shape. Or describe the change in words with
`ask_motion_agent` (spends credits). Verify with `view` `snapshot`.

### Flow 3: generate images into a frame

Create an image node on the canvas (`edit`, a canvas op). The data shape is in
`describe_node_types` `{ "type": "image" }`.

```json
{ "op": "create_node", "project_id": "<project_id>",
  "input": { "canvasId": "<canvas_id>", "type": "image", "x": 0, "y": 1300,
             "data": { "prompt": "Abstract dark gradient with a soft orange glow, no text", "aspect_ratio": "16:9" } } }
```

Read its `version` with `query`:

```json
{ "table": "nodes", "columns": ["id", "version"], "where": [{ "column": "id", "op": "eq", "value": "<node_id>" }] }
```

Generate (spends credits; `medium` must match the node type; `model` omitted keeps the default):

```json
{ "node_id": "<node_id>", "medium": "image", "prompt": "Abstract dark gradient with a soft orange glow, no text", "version": 1 }
```

Look at it with `get_media` `{ "node_ids": ["<node_id>"] }` (fetch `preview_url`). Then put it in the
frame (`edit`, canvas op, `x` and `y` are 0..1 inside the frame):

```json
{ "op": "place_in_frame", "project_id": "<project_id>",
  "input": { "nodeId": "<node_id>", "toFrameId": "<frame_1>", "x": 0.5, "y": 0.5 } }
```

The answer carries the new `element_id`. Size and time it with `set_props` and `set_timing` as in
Flow 2. A video node works the same with `medium: "video"`; it returns `queued`, poll with `query`.

### Flow 4: combine scenes, export MP4 and Lottie

Chain the three frames into one video. Order is left to right on the canvas (`edit`):

```json
{ "op": "combine_scenes", "project_id": "<project_id>",
  "input": { "frameIds": ["<frame_1>", "<frame_2>", "<frame_3>"] } }
```

The answer carries `frameId`, a new frame placed below the scenes. Render it (`render_video`):

```json
{ "node_id": "<combined_frame>", "mode": "browser", "resolution": "1080p" }
```

`browser` mode is free and answers a one-time `render_url` (valid 30 minutes) that you open on any
device: the MP4 renders there and is saved to the project. Poll the file with `get_render`
`{ "run_id": "<run_id>" }`; when `done` it holds `asset_id` and a signed `file_url`. `mode: "server"`
answers 403 `server_render_unavailable` while server rendering is closed.

Lottie is a canvas export, not a render (`edit`; up to 30 s, text becomes shapes, no browser needed):

```json
{ "op": "export_selection", "project_id": "<project_id>",
  "input": { "frameIds": ["<combined_frame>"], "rows": [{ "format": "lottie", "by": "scale", "value": 1 }], "name": "launch" } }
```

It answers `url`, and `skipped` for anything Lottie cannot draw. `format` also takes `dotlottie`,
`png`, `jpg`, `webp`, `svg`, `pdf` (up to 8 rows per call; raster and pdf need the server renderer).

### Flow 5: share a link

`share_motion_frame` publishes the frame and turns the canvas share link on. It answers `url` (a
full-screen looping viewer) and `embed_url`:

```json
{ "node_id": "<combined_frame>" }
```

Share the whole canvas read-only instead (`edit`, answers `{ "shared": true, "path": "/s/<token>" }`):

```json
{ "op": "share_canvas", "project_id": "<project_id>", "input": { "canvasId": "<canvas_id>", "on": true } }
```

Turn it off with `"on": false`; that also kills every frame link.

## 6. Limits worth knowing

- A later step of a `batch` cannot use an id created by an earlier step. Create, then batch.
- A frame op answers 409 on a stale `version`. Re-read and retry.
- `ask_motion_agent` `wait: true` waits about 4 minutes; a turn can run up to 30. Poll
  `get_motion_run` after that.
- Uncensored projects have extra refusals (sharing, models); see `describe` and the error `fix`.
