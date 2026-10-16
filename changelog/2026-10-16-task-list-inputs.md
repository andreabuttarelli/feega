# Task models take video and audio inputs

Prerequisite for Seedance 2.5 and Genjutsu on Higgsfield. A task run sent only
images (`images`, `imageList`) and a last frame; connected videos and audios
never left the canvas.

- `WireFields` gains `video` (single, first upstream video), `videoList`,
  `audioList`; `TaskWireSpec.caps` caps each list (`image` falls back to the old
  `maxRefs`).
- `startTask` signs `referenceVideoUrls` / `referenceAudioUrls` and passes them.
- The uncensored input guard counts a video/audio only when the model's fields
  consume it: a video connected to an image-only model is ignored, as before.
- Signed input URLs live 5 min by default; Higgsfield gets
  `SIGNED_URL_TTL_S.queuedProviderInput` (6 h) because it fetches inputs when a
  queued request starts. Its presigned upload (`/files/generate-upload-url`) was
  discarded: it accepts no mp3/mov and would copy every input for no gain.

No public entry: nothing visible changes until a model declares these fields.
