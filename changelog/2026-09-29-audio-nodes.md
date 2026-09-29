# Audio nodes with ElevenLabs

`audio` is a fourth canvas medium. One node type runs one ElevenLabs operation, chosen in
`params.operation`; `src/lib/canvas/audio-operations.ts` is the single table (inputs, voice or
language needed, duration range, sync or job, default model, USD per character or second).

- Engine: `runGenNode` → `runAudioNode` → `audio-run.ts::runAudio` → provider port
  (`canvas/audio-provider.ts`) implemented by `elevenlabs.ts` (plain fetch, no SDK).
  `ELEVENLABS_BASE_URL` points the adapter at a stub for local browser checks.
- Storage: generated audio goes to `brand-knowledge` under `<userId>/media/audio/`, not
  `canvas-assets`: every signer (canvas asset route, share view, `get_media`, assets page) maps
  `source: generated` to `brand-knowledge`, so a generated file elsewhere would never sign.
- Billing: `logAiCall` provider `elevenlabs`, `flatCostUsd` from the table — characters for TTS,
  output seconds (mp3 128 kbps → bytes / 16000) for the rest; dubbing bills the seconds the
  status call reports. Prices from elevenlabs.io/pricing/api, 2026-09.
- Dubbing is async: `external_job_id = elevenlabs:dubbing:<id>:<lang>`, finished by
  `reconcileAudioNodeRuns` in the run tick; `queuedVideoRuns` skips those ids. A video source
  returns a dubbed mp4, stored as a `video` asset on the audio node.
- Migration `20260929_audio_node.sql`: `audio` in `nodes_type_check` (with `calendar` from
  main) and `assets_type_check`. Applied.
- Waveform: peaks decoded once in the browser (Web Audio), cached per asset id; no library.
- MCP: `run_node_generation` accepts `audio`; `describe_node_types` returns `audio_operations`,
  and with `type: audio` the voice list. No new tool: the MCP surface is pinned at 19.

Not done: pre-run cost for media-input operations (voice changer, isolation, dubbing) shows
"variable cost" — the input duration is not known client-side.
