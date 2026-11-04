# Larger custom components, partial reads and line edits; music over MCP

- Limits raised to 100k html / 100k css / 200k js, with a 700k total per video:
  measurements and the 1 MB Realtime row cap in `docs/adr/0032-custom-component-size.md`.
- `read_component` takes `file`, `offset`, `limit`, `pattern`; a file over 400 lines is no
  longer returned whole by default (`long_files`).
- `update_components` takes line edits (`lines: [N, M]`, `after_line`) alongside find/replace,
  applied atomically.
- `add_music` answered "music is not available in this workspace" through MCP and the canvas
  chat: `runMotionTool` (`tool-run.ts`) never wired `music` nor `analysis`, so beats were never
  marked either. Both are wired; `add_music` is now a spending tool (plan gate), since it
  generates when ElevenLabs is configured and falls back to the CC0 library otherwise.
