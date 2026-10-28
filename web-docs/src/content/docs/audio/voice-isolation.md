---
title: Voice isolation
description: Remove background noise and keep only the voice.
sidebar:
  order: 7
---

## Step by step

1. Add a **Generate audio** node and set **Operation** to **Voice isolation**.
2. Wire an audio node or a video node (its soundtrack) into it.
3. Press Generate. There are no options and no voice to choose.

## Ports

Input: audio or video. Output: audio, the voice without the background.

## Cost

$0.12 per minute of result, about 14 credits a minute. See [Audio](/audio/#cost).

## Agents and MCP

`run_node_generation` with `params: { "operation": "voice_isolation" }` on a node with media wired in.
