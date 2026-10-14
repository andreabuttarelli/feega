# Still graphics in the motion editor, and every motion tool over MCP

**Before.** The motion editor only made videos: no way to keep one frame and export an image,
no A-series poster size. An external agent over MCP reached motion only through
`ask_motion_agent` (a paid chat turn) and a handful of fixed endpoints: none of the ~140 tools
the chat agent edits with.

**Still.** A still is the same `MotionDoc` with `still: { frame }` (`src/lib/motion/still-model.ts`,
ops in `still.ts`). Same engine, same tools; the frame is what gets drawn and exported, and the
clips keep their animation, so a template becomes a poster by picking the settled moment.
`docMode(doc)` is the one switch: the editor page sets `data-mode` and hides transport and
timeline, pins the playhead, and opens `StillExport` instead of `ExportDialog`.
`CompositionSettings` toggles it. `setCanvas` clamps the frame when the doc shortens; the schema
refuses a frame past the end. `docProblems` drops the timeline-only checks (`TIMELINE_ONLY`:
music, tails, holes, holds, junctions) for a still. New format `A poster` 1080×1527 (1:√2 inside
the 1080 short side); post 4:5 and story 9:16 already existed.

**Export.** `exportStill` (`src/lib/server/motion/still-export.ts`) draws the frame in the server
Chromium at `scale` 1 or 2 (`deviceScaleFactor`) as PNG, JPG or WebP, stores it under
`<org>/<project>/stills/`, registers an image asset (`sourceNodeId` = the node) and returns a
signed url. Three callers, one function: the editor form action `still`, the chat tool
`export_image`, and the MCP path through `motion_tool`.

**Canvas node.** No new type: a still is a `motion` node whose doc has `still`. The node data is
derived from the doc on save, so nothing else changes.

**MCP.** One generic endpoint, `POST /api/v1/motion/{node}/tools` `{ tool, input, version? }`
(`runMotionTool` in `tool-run.ts`): builds the chat agent's tools with headless deps, validates
`input` with the tool's own schema, screens it like a chat prompt, runs it, and saves a revision
as agent `mcp` when the doc changed (stale `version` → 409). `GET /api/v1/motion/tools[?name=]`
lists them or returns one with its JSON schema. Tools needing a chat turn (voice, frames, checks,
sub-agents, research) answer `ok: false` from their missing deps. MCP gets one tool,
`motion_tool`, to stay inside the instructions budget (2 000 chars); CLI gets `feega motion
tool`, `tools`, `still`, and `new --still`.

**Discarded.** A separate `still` node type (duplicate of motion's whole path); one MCP tool per
motion tool (140 tools against a tool-list budget); a browser-side image export (would not serve
MCP, and the server one already exists for frames).
