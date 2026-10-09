# Sound score: offline, deterministic sound design

A video had music, voice and nothing between: no whoosh on a transition, no hit on a cut, no
click on a tap. The doc now carries a sound score (`doc.sound`), rendered offline to a WAV that
sits on a "Sound design" audio track as a normal Audio clip.

- `sound/score.ts`: Tone.js-shaped data — voices (whoosh, hit, riser, click, pad, sub, tone;
  gain, pan, reverb, brightness) and events (`at`, `duration`, `note`, `velocity`), `seed`,
  optional `bpm`. Caps: 16 voices, 400 events, 12 s per event, 600 s sounding in total.
- `sound/render.ts`: pure TypeScript synthesis at 48 kHz stereo, seeded per event, Schroeder
  reverb bus, soft limiter. Same score, same samples, on server and browser; length is exactly
  the asked duration. A riser peaks at its end (the reveal).
- `sound/wav.ts`: 16-bit PCM WAV encode/decode.
- `sound/lay.ts`: `laySound` keeps the score in the doc and replaces the previous render's clip.
  Preview, browser export and server render play the same asset through `audioPlan`, so
  preview = export with no new audio path.
- Discarded: Tone.js / `OfflineAudioContext` as the renderer. The agent tools run in Node, which
  has no Web Audio, and two engines' offline renders are not bit-identical. The score keeps
  Tone's shape (instruments, notes, velocity) so a Tone backend can be swapped in later.
