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
- **Models.** `wiro/` and `higgsfield/` models run on those providers and are always queued. An organization can restrict models: see [Model allow-list](/ai/model-allow-list/).
- **Model menu.** Makers come first (Google, ByteDance, Black Forest Labs…); hover or arrow into one to see its models. When more than one API serves a model, a third level lets you pick Auto or a specific provider, each marked `$`, `$$` or `$$$` relative to the others at your current settings. Search filters models directly.
- **Cost preview.** The Generate button shows the credits the run will cost with the chosen model, provider, duration, resolution and variants, and updates as you change them. Each provider is priced at its own rate for that resolution; Auto shows the price of the provider it will actually use.
- **Loops.** `run_node_loop` queues every combination of a node's inputs; `preview_node_loop` is free; more than 50 needs confirmation and more than 1000 is refused.
- **Images.** Remove background and 2×/4× upscale from the image toolbar.
- **Uncensored models** run only in an uncensored project that the org owner turned on in Settings.

Node data shapes per type: MCP `describe_node_types`. Tool details: [MCP tools](/reference/generated/mcp-tools/).
