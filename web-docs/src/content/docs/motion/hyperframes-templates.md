---
title: HyperFrames templates
description: Lower thirds, captions, text effects, counters, UI cards and wipes from the HyperFrames registry, as motion templates.
sidebar:
  order: 13
---

Sixty-four 2D blocks and components of the [HyperFrames](https://github.com/heygen-com/hyperframes) registry
(Apache-2.0) are built-in motion templates: lower thirds, caption styles, text effects, titles, counters and
charts, UI cards, wipes and transitions, and ambient overlays. Each keeps the original length and its tween timings.

## From the editor

1. Open a motion frame and open **Templates**.
2. Search for the name (for example *Lower third, clean bar*, *Count up*, *Iris reveal*) or filter by role.
3. Insert it and edit its fields in the Properties panel: the text, colours and numbers. Fields that take a
   picture are media fields: pick one from the project assets, upload a file or drag it from the canvas.

## From an agent, MCP or CLI

The motion agent lists them with `list_templates`, reads every field with `get_template` and places one with
`add_template` (ids start with `builtin:hyperframes-`, e.g. `builtin:hyperframes-count-up`). `set_template_fields`
changes text, colours, numbers and media. From the CLI:

```bash
feega motion ask <nodeId> "add the hyperframes lower third clean bar for 'Dr. Maya Chen'"
```

## Not included

WebGL, shader and 3D blocks, anything built on footage or audio, and every block named after a brand.

## Licence

HyperFrames is Apache-2.0, © 2026 HeyGen, Inc. The licence text, the copyright notice and the statement of
changes are in `THIRD_PARTY_NOTICES.md`. Upstream media and brand assets are not used.
