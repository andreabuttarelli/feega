---
title: Shader library
description: Feega's own shaders, ready on every image and video.
sidebar:
  order: 12
---

Feega ships its own shaders. They sit next to your workspace's custom effects: in the canvas effects editor, and in the motion agent's `list_effects`. Put one on an image or video clip with `add_custom_effect` and the effect id below.

Every frame is a function of time and params only, so preview and export match frame for frame. Any number param can be keyframed.

| Effect id | Look | Params |
|---|---|---|
| `library-ember-field` | Motes drifting at three depths, with depth of field | `base`, `color_a` (near), `color_b` (far), `density`, `size`, `depth`, `speed` |
| `library-voice-orb` | A voice-assistant orb | `state` (0 idle, 1 thinking, 2 speaking), `energy`, `size`, four colours |
| `library-petal-field` | Glowing flowers on near-black; the one under the pointer opens and glows | `density`, `speed`, `pointer_x`, `pointer_y`, `hover`, four colours |

## Voice orb states

`state` blends between whole numbers. Keyframe it 0 → 1 → 2 to go from idle to thinking to speaking, and drive `energy` with the voice level.

## Pointer

`pointer_x` and `pointer_y` run from 0 to 1, measured from the top left. In a video, keyframe them to script a pointer path. `hover` sets how strongly flowers react.
