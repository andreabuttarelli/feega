---
title: Text to speech
description: Turn a script into a voice-over with an ElevenLabs voice.
sidebar:
  order: 2
---

Turns text into spoken audio in the voice you pick.

## Step by step

1. Add a **Generate audio** node and set **Operation** to **Text to speech**.
2. Write the script in the node, or wire a text node into it. Example: *Meet the new runner. Lighter, faster, made to move.*
3. Pick a **Model**: `eleven_multilingual_v2` (default), `eleven_v3`, `eleven_flash_v2_5` or `eleven_turbo_v2_5`.
4. Pick a **Voice**. **Standard voices** are the default ElevenLabs voices; **My voices** are your organization's own (see [Voices](/audio/voices/)). The play button previews the selected voice. With nothing picked, the voice is George.
5. Optionally move **Stability**, **Similarity** and **Style** (0 to 1). They are sent only once you touch them.
6. Press Generate. The MP3 lands in the node's audio output.

## Ports

Input: text. Output: audio.

## Cost

Per character of the script: $0.08 per 1,000 on `eleven_multilingual_v2` and `eleven_v3`, $0.04 per 1,000 on the flash and turbo models. See [Audio](/audio/#cost).

## Agents and MCP

`run_node_generation` with `medium: "audio"`:

```json
{ "node_id": "<audio node>", "medium": "audio", "version": 3,
  "params": { "operation": "text_to_speech", "voiceId": "<voice id>", "stability": 0.5 } }
```

The script is the node's prompt or connected text. `describe_node_types` with `type: audio` lists voice ids.

A voice that belongs to another workspace is refused (`voice_not_yours`), and cloned voices cannot be used in uncensored projects.
