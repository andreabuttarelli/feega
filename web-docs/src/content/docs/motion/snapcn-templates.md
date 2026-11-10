---
title: snapcn templates
description: The free snapcn product-demo animations, ported to feega as motion templates.
sidebar:
  order: 12
---

The free components of [snapcn](https://snapcn.dev) (MIT) are built-in motion templates: text reveals and
highlights, captions, logo stings, prompt and agent scenes, device and screen frames, cursor moves and full
launch scenes. Each one plays at the original size, frame rate and length, with the same curves and colours.

## From the editor

1. Open a motion frame and open **Templates**.
2. Search for the name (for example *Text reveal*, *Agent steps*, *Prompt send*). snapcn templates carry the
   original name.
3. Insert it, then edit its fields in the Properties panel: the text, the theme (light or dark), colours
   (*transparent* keeps the theme colour), font (*sans* keeps the component's own face) and the timing in frames.

## From an agent, MCP or CLI

The motion agent lists them with `list_templates`, reads every field with `get_template` and places one with
`add_template` (ids start with `builtin:snapcn-`, e.g. `builtin:snapcn-text-reveal`). From the CLI:

```bash
feega motion ask <nodeId> "add the snapcn text reveal saying 'Meet Acme Billing'"
```

## Licence

snapcn is MIT, © 2026 Sri Nath (snap-cn); the notice is in `THIRD_PARTY_NOTICES.md`. snapcn's paid *Pro*
components are not included.
