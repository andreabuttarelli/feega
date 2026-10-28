---
title: Voice changer
description: Re-speak an existing recording in a different voice, keeping the performance.
sidebar:
  order: 3
---

Takes a recording and says the same thing, with the same timing and delivery, in another voice.

## Step by step

1. Add a **Generate audio** node and set **Operation** to **Voice changer**.
2. Wire an audio node or a video node into it. A video contributes its soundtrack. If several are wired, the first audio is used, otherwise the first video.
3. Pick a **Model**: `eleven_multilingual_sts_v2` (default) or `eleven_english_sts_v2`.
4. Pick a **Voice** and, if you like, the Stability, Similarity and Style sliders, as in [Text to speech](/audio/text-to-speech/).
5. Press Generate.

## Ports

Input: audio or video. Output: audio.

## Cost

$0.12 per minute of result, about 14 credits a minute. See [Audio](/audio/#cost).

## Agents and MCP

`run_node_generation` with `medium: "audio"` and `params: { "operation": "voice_changer", "voiceId": "<id>" }`, on a node that has the media wired in.
