---
title: Dubbing
description: Translate and re-voice a video or an audio file into another language.
sidebar:
  order: 4
---

Dubbing translates the speech of a video or an audio file into a target language. It runs as a job: the node keeps running and the result lands when ElevenLabs finishes, like a video render.

## Step by step

1. Add a **Generate audio** node and set **Operation** to **Dubbing**.
2. Wire a video or an audio node into it.
3. Pick the **Language**: English, Italian, Spanish, French, German, Portuguese, Dutch, Polish, Japanese, Chinese, Korean, Arabic, Hindi, Russian or Turkish. There is no default; the node asks you to pick one.
4. Press Generate. The node stays in the running state.
5. When the job is done the outputs appear.

## Ports

Input: video or audio.

- From a **video**: two outputs, **Dubbed video** and **Audio** (the dubbed soundtrack alone).
- From an **audio** file: one output, **Audio**.

## Cost

$0.50 per minute of media, 60 credits a minute, billed when the job finishes. See [Audio](/audio/#cost).

## Agents and MCP

`run_node_generation` with `medium: "audio"` and `params: { "operation": "dubbing", "targetLanguage": "it" }`. The call comes back queued; poll the node with `query` until it holds its asset.
