---
title: Camera
description: One 3D camera for the whole video, with layers at their own depth.
sidebar:
  order: 4
---

A video has at most one camera, and it films every layer: text, shapes, images, video clips and custom components. Each layer sits at its own depth; when the camera moves, near layers move more than far ones (parallax). Move the camera for a push-in, orbit, pan or focus pull, not each layer.

## Minimal push-in

Ask the agent, or call the tools through MCP (`edit` with `op` set to the tool name):

1. `set_camera` `{}` turns the camera on.
2. `set_clip_depth` `{ clip_id: "background", depth: 2500 }` pushes the background far; `{ clip_id: "title", depth: -150 }` brings the title forward. Depth is in pixels behind the focus plane, negative is closer.
3. `apply_camera_preset` `{ preset: "dolly-in", start: 0, duration: 3 }` pushes in over three seconds.

At rest every layer keeps its size; during the push-in the title grows faster than the background.

`set_clip_depth` with `space: "screen"` keeps a caption or logo flat on top, ignoring the camera. Other presets: dolly-out, truck, pan, orbit, crane, dolly-zoom, rack-focus. `set_camera_keyframes` animates one camera value (x, y, z, rotateX/Y/Z, fov, focusDistance, aperture).

The canvas, the editor preview and exports draw the same camera move. Depth of field and lights show in the editor preview and exports only.
