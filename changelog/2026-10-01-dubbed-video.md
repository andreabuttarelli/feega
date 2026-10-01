# Dubbing a video outputs the dubbed video and its audio track

ElevenLabs `GET /v1/dubbing/{id}/audio/{lang}` returns the dub in the source format (MP3 or MP4,
per their docs). Before: the audio node stored the MP4 as a `video` asset under `media/audio/`,
showed it in an audio player, and fed the MP4 downstream as **audio** (`referenceAudioUrls`) —
any node wired to it got a video where it expected a voice track.

Now:
- `AUDIO_OPERATIONS[*].outputPorts` is keyed by input kind (`text|audio|video`). Dubbing a video
  outputs `['videos', 'audios']`; everything else stays `['audios']`.
- `finishAudioJob` deposits one asset per output port: the MP4 as `video`, the track extracted
  with ffmpeg (`audio-track.ts`, MP3 192k) as `audio`. Both pass `markGenerated` (`ai_marked`).
  Billed once. Input kind of a finished dub is read from the returned MIME.
- Node data gains `outputRefs: { videos?, audios? }`; `refId` stays the primary output.
- Two output handles `out:videos` / `out:audios` (same `out:` convention as select). Server
  `upstream.ts` resolves them; an edge without a handle on a dubbed video feeds video, not audio.
  `verdictBetween` / `edgeKindsFor` judge a named handle by its own medium.
- Audio node result (`AudioResult.svelte`): video + player, one download menu
  (`NodeDownload` `files`), filenames `<name>-<lang>-<id>-ai-generated.mp4|mp3`.

Not done: promote reads `output_asset_id`, which generated nodes never write (pre-existing, all
generated nodes); the shared view (`/s/[token]`) still shows audio nodes as audio only.
