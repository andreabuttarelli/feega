# Sound design: agent tool, API, CLI, MCP, quality gate

The score engine (`sound/`) had no way in. Now:

- Agent tool `compose_sound` (`motion-tools.ts`): validates the score, renders it via the
  `sound` port (`storeSound` in `server/motion/sound.ts`: WAV to `canvas-assets`
  `<org>/<project>/sound/`, asset row `audio/wav`), then `laySound`. Always the whole score;
  a second call replaces the first render's clip. `get_motion_doc` shows `sound`.
- API `POST /api/v1/motion/[nodeId]/sound` (`writeSound`): same path, saved as a revision on
  the head with optimistic version. CLI `feega motion sound <nodeId> score.json`, MCP
  `write_motion_sound` (41 tools; instruction text trimmed to stay under 2000 chars).
- Gate `unaccented` (Warning, launch film and UI morph): a scene cut with no non-bed sound event
  (whoosh starting up to 2 frames after, or covering the cut within 1 s). Pad and tone are beds,
  not accents.
- Guidance: launch-film style rule and DESIGN.md "sound".
- Discarded: sandboxed code scores (data covers every case asked; code would need a new sandbox
  for audio), live-only Tone playback (preview would differ from export).
