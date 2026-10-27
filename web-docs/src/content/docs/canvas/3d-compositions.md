---
title: 3D compositions
description: Arrange images in an animated 3D scene.
sidebar:
  order: 17
---

The **Composition** node arranges images in an animated 3D scene (slanted grid, carousel, space cloud, ring, spiral, vertical flow, coverflow) with a camera moving over time.

- **Connect images** to its input, directly or through a **List** node. If a layout needs more items, linked images repeat in sequence.
- **Open editor** (button or double-click): 3D preview with playback on the left; layout, camera, background, duration and format on the right.
- **Layout and camera:** each layout has its own parameters (columns, spacing, depth, motion, distribution). The camera follows a preset path: fixed, slow orbit, push in, dolly.
- The motion is always a closed loop with expo easing: the last frame equals the first.
- **Reset** restores the selected layout and camera, plus background, duration and format, to their designed values.
- **Save** writes the settings to the node; **Cancel** closes without saving. Video export is not available yet: the editor prepares the scene only.
