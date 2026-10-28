---
title: Audio
description: Speech, voice changing, dubbing, music, sound effects and voice isolation, powered by ElevenLabs.
sidebar:
  order: 1
---

feega generates audio with ElevenLabs. Every operation runs in one node type, **Generate audio**, and lands as an audio asset you can wire into other nodes or place on a motion timeline.

| Operation | Input | Output | Billed per |
|---|---|---|---|
| [Text to speech](/audio/text-to-speech/) | text | audio | character |
| [Voice changer](/audio/voice-changer/) | audio or video | audio | second |
| [Dubbing](/audio/dubbing/) | video or audio | dubbed video and audio, or audio | second |
| [Music](/audio/music/) | text | audio | second |
| [Sound effects](/audio/sound-effects/) | text | audio | second |
| [Voice isolation](/audio/voice-isolation/) | audio or video | audio | second |

Also: [voices](/audio/voices/) (library, design, clone, manage) and [voice-over and music in motion videos](/audio/motion-voiceover-music/).

## The Generate audio node

1. Add a **Generate audio** node from the add bar.
2. Pick the **Operation**. The inputs, the options and the ports change with it.
3. Write the text in the node, or wire a text node in. For audio and video operations, wire a media node in.
4. Press Generate.

If something is missing the node says what: *Write the text or connect a text node*, *Connect an audio or video node*, *Pick a target language*, *Duration out of range*.

Wire colour for audio is orange. Results are MP3 (44.1 kHz, 128 kbps), except a dubbed video, which stays a video.

## Cost

Audio spends credits: the provider rate in dollars, times 120 credits per dollar, rounded.

| Operation | Rate | Example |
|---|---|---|
| Text to speech (`eleven_multilingual_v2`, `eleven_v3`) | $0.08 per 1,000 characters | 1,000 characters is 10 credits |
| Text to speech (`eleven_flash_v2_5`, `eleven_turbo_v2_5`) | $0.04 per 1,000 characters | 1,000 characters is 5 credits |
| Voice changer | $0.12 per minute | 1 minute is 14 credits |
| Dubbing | $0.50 per minute | 1 minute is 60 credits |
| Music | $0.15 per minute | 30 seconds is 9 credits |
| Sound effects | $0.12 per minute | 5 seconds is 1 credit |
| Voice isolation | $0.12 per minute | 1 minute is 14 credits |

Per-second operations are billed on the length of the result (dubbing: the length the provider reports). A failed run is not billed. Org spend caps and the model allow-list apply as for any generation, see [Generate and credits](/ai/generate-and-credits/).

## Agents, MCP and CLI

- MCP `run_node_generation` with `medium: "audio"` and `params.operation` set to `text_to_speech`, `voice_changer`, `dubbing`, `music`, `sound_effects` or `voice_isolation`. It never creates a node: create it first (`insert_row`) and pass its `version`.
- MCP `describe_node_types` with `type: audio` lists `audio_operations` (inputs, default model, price) and the voices.
- Dubbing comes back queued, like a video: poll the node.
- The CLI has no dedicated audio command. Use the MCP server.

If the server has no ElevenLabs key, audio generation answers `elevenlabs_not_configured`.
