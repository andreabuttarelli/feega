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
- Video frames go up to 3840 × 2160 (2160p export).
- 120 fps renders on servers.

## Lottie

Export a frame as Lottie or dotLottie, up to 30 seconds, with shapes, gradients, masks and text as shapes. Anything that cannot be written is listed. To bring a Lottie file in, see [Lottie import](/integrations/figma-and-svg/#lottie-import).

## Stills and vectors

- A still frame exports as an image straight from the canvas. Any element exports as PNG at 1× to 4× or as SVG.
- SVG and PDF are true vector: shapes, gradients, masks and text as outlines. Anything that cannot be drawn is listed.
- Image export on the server needs headless Chromium; see [Self-hosting](/self-hosting/).

## From the CLI and MCP

`feega canvas export <projectId> <targets...>` and `feega motion render <nodeId>`; MCP `render_video` and `get_render`.
