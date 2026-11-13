---
title: RenderComp templates
description: Fifty free motion templates (logo stings, titles, transitions, charts, social scenes and loops) ported to Feega.
sidebar:
  order: 13
---

Fifty free templates from [RenderComp](https://github.com/RenderComp/free-remotion-templates) (MIT) are built-in
motion templates: logo reveals, titles and text effects, transitions, animated charts, social scenes, pixel-art
pieces and background loops. Each one plays at the original size, frame rate and length, with the same curves and colours.

## From the editor

1. Open a motion frame and open **Templates**.
2. Search for the name (for example *Brush stroke reveal*, *Kpi counter*, *Starfield*). The newest templates are listed first.
3. Insert it, then edit its fields in the Properties panel: text, colours, font and timing.

List-shaped fields (chart rows, chat messages, colour lists) are one text field with separators; the field title
shows the format, for example `label;value;colour | label;value;colour`.

## From an agent, MCP or CLI

The motion agent lists them with `list_templates` and places one with `add_template` (ids start with
`builtin:rendercomp-`, e.g. `builtin:rendercomp-kpi-counter`). From the CLI:

```bash
feega motion ask <nodeId> "add the kpi counter template with three metrics"
```

## Licence

MIT, (c) 2026 Trimora Inc.; the notice is in `THIRD_PARTY_NOTICES.md`.
