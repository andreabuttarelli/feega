---
title: UI loop templates
description: Animated backgrounds, text effects and card accents ported from Magic UI as motion templates.
sidebar:
  order: 13
---

Twenty components of [Magic UI](https://magicui.design) (MIT) are built-in motion templates: backgrounds
(meteors, ripple, flickering grid, animated grid pattern), text effects (typing, morphing text, word rotate,
number ticker, hyper text, gradient, shiny, aurora and line-shadow text, spinning text) and card accents
(marquee, orbiting circles, border beam, shine border, animated list, circular progress). Each keeps the
original defaults, timing and easing.

## From the editor

1. Open a motion frame and open **Templates**.
2. Search for the name, for example *Meteors* or *Number ticker*. They are listed as new.
3. Insert it and edit its fields in the Properties panel: text, numbers, colours, font and speed.

## From an agent, MCP or CLI

The motion agent lists them with `list_templates`, reads fields with `get_template` and places one with
`add_template` (ids start with `builtin:magicui-`, for example `builtin:magicui-number-ticker`).

```bash
feega motion ask <nodeId> "add the number ticker counting to 12,000"
```

## Licence

Magic UI is MIT, Copyright (c) Magic UI; the notice is in `THIRD_PARTY_NOTICES.md`.
