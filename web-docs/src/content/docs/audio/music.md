---
title: Music
description: Generate a music track from a written brief.
sidebar:
  order: 5
---

Generates a track from a description.

## Step by step

1. Add a **Generate audio** node and set **Operation** to **Music**.
2. Describe the music in the node or wire a text node in. Example: *Upbeat electronic bed, 120 bpm, confident, no vocals.*
3. Set **Seconds**: 3 to 600, 30 by default. Outside the range the node refuses.
4. Press Generate. Model: `music_v1`.

## Ports

Input: text. Output: audio.

## Cost

$0.15 per minute: a 30-second track is 9 credits. See [Audio](/audio/#cost).

## Agents and MCP

`run_node_generation` with `params: { "operation": "music", "duration": 30 }`. For music under a motion video, see [Voice-over and music in motion](/audio/motion-voiceover-music/).
