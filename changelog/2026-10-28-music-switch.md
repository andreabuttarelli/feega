# Music generation behind one switch

ElevenLabs `/v1/music` answers 402 on our free plan, every time. #1487 made
the message clear; this stops users and agents from trying at all.

- `ELEVENLABS_MUSIC_ENABLED` (default off), read only in
  `src/lib/server/elevenlabs-music.ts`, next to the provider config.
- Local mode (`PUBLIC_FEEGA_LOCAL=1`) with `ELEVENLABS_API_KEY` always has
  music: the key is the user's own and may be on a paid plan.
- Hidden: audio node operation list (`audioOperationIdsFor`), model
  catalogue, `describe_node_types` audio tables, the `generate_sound`
  summary, the "Add music..." toolbar entry. The motion `add_music` tool
  stays and falls back to the CC0 library.
- Refused upfront with `music_unavailable`: `runAudio` (every node run) and
  `generateSound` (editor op, SoundDialog). An existing music node still
  shows its operation, and refuses on run.
- Not hidden: the CLI's static `generate_sound` text (it cannot know the
  server flag), and the podcast template's music node, which refuses on run.
- Tool-surface pin: only `generate_sound` summary moves.
