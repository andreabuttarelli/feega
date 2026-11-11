---
title: Generation nodes
description: Generate text, image, video, audio and 3D into a node.
sidebar:
  order: 2
---

A generation node holds a prompt, a model and its result. Its `type` is one of `text`, `image`, `video`, `audio`, `model3d` (the same engine as the canvas Generate button; MCP `run_node_generation`).

- **Inputs.** Connect other nodes to feed them in. A video with a start and end frame has two inputs (`target_handle`).
- **Medium must match the node type**, or the run is refused before anything is spent.
- **Concurrency.** Pass the node's current `version`; a stale one returns `conflict`.
- **Video is queued.** A video comes back `queued` and lands later; the node stays `running`.
- **Models.** `wiro/` image, video and 3D models and `higgsfield/` models run on those providers and are always queued. `wiro/` text and audio models run inline: the node waits for the answer (up to four minutes) and fills in when it lands. An organization can restrict models: see [Model allow-list](/ai/model-allow-list/).
- **Model menu.** Two columns. Left: model families (Claude, GPT, Gemini, Kling, Veo, Flux, ElevenLabs…) with a count; Recommended sits on top. Right: that family's models, newest first, with the price in dollars under a header that fits the medium (per 1M tokens in / out, per image, per second, per 1K characters, per run). Arrow keys move across columns, Enter picks, Esc closes. When more than one API serves a model, a "Run on" row under the list offers Auto (cheapest healthy provider, the default) or a specific provider, each marked `$`, `$$` or `$$$` relative to the others at your current settings; arrow right from a model to reach it. Typing in the search field flattens the list across families.
- **Full size.** Double-click a generated image or video, or use the open button next to download, to open the original file in a new tab.
- **Cost preview.** The Generate button shows the credits the run will cost with the chosen model, provider, duration, resolution and variants, and updates as you change them. Each provider is priced at its own rate for that resolution; Auto shows the price of the provider it will actually use.
- **Stop.** While a node runs, its Generate button in the selection bar becomes Stop, with a progress ring. A disabled Generate button says why when you hover it.
- **Loops.** `run_node_loop` queues every combination of a node's inputs; `preview_node_loop` is free; more than 50 needs confirmation and more than 1000 is refused.
- **Images.** Remove background and 2× upscale from the image toolbar.
- **Uncensored models** run only in an uncensored project that the org owner turned on in Settings.

Node data shapes per type: MCP `describe_node_types`. Tool details: [MCP tools](/reference/generated/mcp-tools/).

## Where the model list comes from

The model menu of a node is a catalogue that feega refreshes on a schedule, so new models appear without a release. Kie.ai models come from Kie's own sources, Wiro models from its live tool list, and Higgsfield models from the public Higgsfield docs: each model page gives its endpoint and input schema, and a model is added only if feega can fill every input it requires (a prompt and image or video URLs). Prices come from the provider's own estimate call, so a new model arrives with a credit price.

- A model that feega wires by hand keeps priority over the same endpoint found in the docs: the hand entry carries what the docs do not say, such as reference limits.
- **Wiro text and audio.** A short curated list, not the whole Wiro catalogue: LLMs (GPT-5 Nano and Mini, Gemini 3 Flash, DeepSeek V4.1 Flash, Grok 4.1 Fast, Claude Sonnet 5) in the text node, and speech, sound effects and music (Eleven v4 and v4 Turbo, Chatterbox Multilingual, ElevenLabs Sound Effects v3 and Music v2, Stable Audio 3 Small Music, Lyria 3) in the audio node, all under the Wiro heading. Text is estimated from Wiro's per-million-token rates, speech per character, music and effects per run or per duration; the credits charged follow Wiro's billed cost for the task. A model whose price Wiro does not publish is not offered. Wiro audio models use the model's default voice: the voice picker applies to ElevenLabs models only.
- If the Higgsfield docs cannot be reached, the models already known stay as they are.
- A model that leaves the docs is expired, never deleted.

To see what a project can run now, open the model menu of a node, or ask an agent: `list_models` with the medium (`image`, `video`, ...) lists the models with provider, credits and routes.

```bash
feega canvas models $PROJECT --medium video
```
