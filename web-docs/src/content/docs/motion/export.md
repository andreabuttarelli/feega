---
title: Export
description: Video, animation, image and vector exports.
sidebar:
  order: 6
---

## Video and animation

The formats come from the exporter code: see the generated table in [Export formats](/reference/generated/export-formats/).

- GIF can loop forever, play once or boomerang, up to 30 seconds, 30 fps and 1920 px wide.
- APNG keeps transparency, up to 10 seconds.
- The file is as long as the video's duration (set it in the timeline). With a loop region set, the dialog offers **Range**: Work area (the default) or Whole video. A work-area range renders in the browser, without sound.
- A frame takes up to 16 384 px a side, so a tall page can be animated too. The resolution (720p to 4K) sets the short side of the video, whatever the size of the frame on the canvas, at most 3840 px on the long side; the export dialog says when a size does not fit. A browser render draws a small frame up to that resolution as the server does.
- 120 fps renders on servers.
- "Render in this browser" draws every frame with the same GPU engine as the canvas, then encodes. Videos with line or vector shapes, motion blur or 3D devices are drawn by the previous HTML engine instead; the file has the same size, frame rate and sound either way.
- A browser render keeps its full speed in a background tab; only the screen wake lock is let go.
- To check a frame or a few seconds before the whole video, render a stretch: `feega motion render <nodeId> --from 3 --to 3.5`, or MCP `render_video` with `from`/`to` (seconds, `to` exclusive; one frame is `to = from + 1/fps`). It goes through the same pipeline as the full export, so the pixels match; it has no sound and renders in the browser only.

## Lottie

Export a frame as Lottie or dotLottie, up to 30 seconds, with shapes, gradients, masks and text as shapes. Anything that cannot be written is listed. To bring a Lottie file in, see [Lottie import](/integrations/figma-and-svg/#lottie-import).

## Stills and vectors

- A still frame exports as an image straight from the canvas. Any element exports as PNG at 1× to 4× or as SVG.
- The **Export** section at the bottom of the right bar works like Figma's: each row is a scale (0.5× to 4×) and a format, **+** adds the next scale, **−** removes a row, and **Export** downloads the file (a zip when there are several). It exports the frame, or the layers selected in it. Right-click → Export and **Export…** in the command palette (`⌘K`) open the same choices.
- An animated frame exports the frame shown when you open the dialog: the playhead if you moved it, else its poster frame (see [Timeline](/motion/timeline/#duration-and-poster-frame)), else the frame where its motion settles. MCP `export_selection` takes `seconds` for the same choice.
- The scale is of the frame as big as it is on the canvas: 1× of a frame 700 px wide is 700 px, 2× is 1400 px. Exports start at 2×, in the app, `feega canvas export` and MCP `export_selection`.
- SVG and PDF are true vector: shapes, gradients, masks and text as outlines. Anything that cannot be drawn is listed.
- Image export on the server needs headless Chromium; see [Self-hosting](/self-hosting/).

## From the CLI and MCP

`feega canvas export <projectId> <targets...>` and `feega motion render <nodeId>`; MCP `render_video` and `get_render`.
