# MCP: describe op, still frames, voice-over in motion_tool

An outside agent had to read a long tool description to learn the canvas surface and could not
make a still poster in one call or lay a voice-over from `motion_tool`.

- `describe` on `canvas_tool` and `motion_editor_op`: every op with access and one line, or one op's
  strict JSON input schema. Handled in the route, not in the op registry, so the chat parity checks
  do not see a new op. An unknown op now answers the same list with a `fix`.
- `draw_frame` takes `still` (seconds): a post or poster frame in one call.
- `generate_voiceover` runs in `motion_tool` (and `batch`) with the credit gate of a chat turn
  (`SPENDING_TOOLS`). Before it answered "ask the motion agent".
- `mcp-showcase-parity.test.ts` pins the surface the design showcase scripts used
  (`POST /api/v1/motion/{node}/tools`, `POST /api/v1/org/canvas`); the MCP tools are pass-through.
- Discarded: new tools per gap. Frame creation, free shapes, element moves and selection export were
  already ops.
