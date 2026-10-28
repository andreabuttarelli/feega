---
title: Voice-over and music in motion
description: Add a generated voice-over or music track under a motion video.
sidebar:
  order: 9
---

A motion frame can get a voice-over and a music track as Audio clips, without leaving the frame.

## Step by step

1. Select the motion frame.
2. Open the selection toolbar or the right-click menu and pick **Add voice-over…** or **Add music…**.
3. Voice-over: write the **Script** (up to 2,000 characters). Music: describe the music and set **Length (s)**, 3 to 60, prefilled with the length of the frame.
4. Press **Generate · uses credits**.
5. The audio is placed as an Audio clip on the timeline, starting at the current playhead position.

The voice-over uses the default voice (George) and `eleven_multilingual_v2`; music uses `music_v1`. The text is screened for safety first. The dialog reports: audio not set up on the server, blocked by the safety review, not enough credits.

Cost is the same as the canvas operations: [Text to speech](/audio/text-to-speech/) and [Music](/audio/music/).

## The motion agent

The motion agent has the same abilities:

- `generate_voiceover`: `text`, `start` in seconds, optional `voice_id`.
- `add_music`: a `mood` and optional `bpm`. It spans the whole video and its beats are marked for cutting to the beat. When the server has no ElevenLabs key, it picks a CC0 track from the built-in library instead.
