# Wiro LLMs in the text node, Wiro speech and music in the audio node

Before: the Wiro sync read only image, video and 3D categories; text nodes offered OpenRouter and
Kie.ai, audio nodes only ElevenLabs.

- **Sync** (`wiro-catalogue.ts`): also reads `partner-llm`, `text-to-speech`, `music-generation`.
  Only slugs in `CURATED_WIRO_MODELS` land (6 LLMs, 7 audio): Wiro lists hundreds, most unpriced
  self-hosted checkpoints. LLM/audio categories outside the list are dropped — this also stops the
  `uncensored` search from landing Wiro LLMs as `image` rows.
- **Pricing**: Wiro LLM prices are `cp-readoutput` with the rate only in a free-text `note`;
  `wiroTokenRates` reads input/output $/1M from it. Unreadable → no row → not offered. Audio keeps
  the `dynamicprice` lines: `cpr` per run/duration, `cp-promptlength` per character
  (`ModelChoice.creditsPerCharacter`). The charge itself is Wiro's `totalcost` for the task.
- **Catalogue `audio`**: `ai_models_catalogue_check` in the migrations never listed `model3d`
  either; prod was changed by hand. Migration `20261107120000_ai_models_audio_catalogue.sql`
  (not applied) adds `audio`. Until then the sync upserts audio rows separately and only warns
  when they are refused, so the rest of the sync stays green.
- **Runs** (`wiro-run.ts`): text and audio run inline (run, poll `Task/Detail` every 1.5 s, 4 min
  cap), not through the task cron: an LLM answer takes seconds. Text = `debugoutput` (Wiro's merged
  plain text). Audio = first output, downloaded and stored like ElevenLabs audio
  (`depositAudio`, `brand-knowledge`). One `ai_calls` row per run, provider `wiro`.
- **Audio model resolution**: `audioModelFor` kept coercing any non-ElevenLabs id to the default;
  a `wiro/` id now passes through. Audio is no longer treated as a task medium in
  `providerRunOf`, so Wiro audio prompts go through moderation like ElevenLabs ones.

Discarded: a hand-written price table (drifts silently); queuing via the task cron (seconds-long
jobs, and the cron lands media assets, not text).

Not done: Wiro voices are not exposed (the model's default voice is used); the audio controls'
ElevenLabs model `<select>` does not know Wiro ids.
