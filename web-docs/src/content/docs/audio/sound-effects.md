---
title: Sound effects
description: Generate a short sound effect from a text description.
sidebar:
  order: 6
---

## Step by step

1. Add a **Generate audio** node and set **Operation** to **Sound effect**.
2. Describe the sound. Example: *A glass bottle cap popping, then a short fizz.*
3. Set **Seconds**: 0.5 to 30, 5 by default.
4. Press Generate. Model: `eleven_text_to_sound_v2`.

## Ports

Input: text. Output: audio.

## Cost

$0.12 per minute: a 5-second effect is 1 credit. See [Audio](/audio/#cost).

## Agents and MCP

`run_node_generation` with `params: { "operation": "sound_effects", "duration": 5 }`. Sound effects are not in the motion editor's voice-over and music dialogs.
