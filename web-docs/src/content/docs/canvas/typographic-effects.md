---
title: Typographic effects and templates
description: Four looks that rebuild an image or video out of words and glyphs, plus effect and composition templates.
sidebar:
  order: 17
---

Four effects of the **Effects** node turn any image or video into type. They run live on the canvas and in the exported file, with the same result.

| Look | What it does | Pick it when |
|---|---|---|
| **Word weave** | Keeps the picture and threads a repeating word over it, in fragments placed only on edges and strong contrast, tinted with the colour underneath. | You want to sign a photo or clip with a name while the image stays the hero. |
| **Word field** | A dark wall of monospaced words; each word is as bright as the image under it. A few words become solid accent blocks. | Tech, data or security mood on a portrait or product. |
| **Glyph tiles** | A grid of rounded tiles in a small palette, one glyph on each, an accent line and label chips. | A bold, poster-like mosaic of a clear subject. |
| **Word silhouette** | A flat colour field of faint words; the subject's silhouette is written in bright words, its brightest core in the accent colour. | A quiet poster of one recognisable shape. |

## Parameters

- **Words / Label chips**: the word list (commas, spaces or new lines). Word weave repeats it as one word.
- **Text size / Tile size**: measured on a 1080 px frame, so the preview and a 4K export look the same.
- **Threshold, contrast, palette levels**: how the picture's brightness maps to text brightness or tile colour.
- **Background, text and accent colours**: the accent defaults to Feega orange `#ff5100`.
- **Change when the picture changes by**: a word or glyph changes only when the picture under it changes by more than this amount, then crossfades over **Crossfade (s)**. Steady footage gives steady text.
- **Follow camera motion**: on video, words travel with a pan instead of staying pinned to the screen.
- **Random changes per second (noise)**, **Scroll**, **Loop length**: optional extra motion. Noise defaults low; scroll is off by default. Both loop seamlessly.

## Templates

Templates insert a ready-wired group of nodes. Open them from the canvas template gallery or from **Templates** in the sidebar, filtered by type:

- **Motion**: frames and posters.
- **Composition**: one per composition layout (grid, carousel, helix, bento...), with three image nodes wired in.
- **Effects**: an image wired into an Effects node already set to a look: the four above plus Colour ASCII, Halftone print, Orange duotone, Shape mosaic and 1-bit dither.

The canvas agent sees the same templates and effect descriptions (`list_templates`, `list_effects`), so it can pick a look for you.
