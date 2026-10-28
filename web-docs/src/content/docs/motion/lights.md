---
title: Lights
description: Light the flat layers of the camera world.
sidebar:
  order: 5
---

Lights shade the flat layers of a video that has a camera. Add one in the frame Properties, under **Lights**, or ask the agent (`set_stage_light`).

## Add and animate a light

1. Add a camera to the frame: select the frame and press **Add a camera** in its Properties. Layers live in the camera world by default.
2. Give the layers depth and turn them: select a layer, open its **3D** section, set **Rotate Y** (and depth) so the cards face different ways.
3. In the frame Properties, open **Lights** and press **ambient**, **point**, **spot** or **parallel**. The light is a new clip on the timeline.
4. Select the light clip. Move it with X, Y and depth, aim a spot or parallel light with Rotate X / Rotate Y, and set colour, intensity, falloff, cone angle and cone feather.
5. To animate, turn on Animate mode (`E`), move the playhead and change a value: each change is keyed. A spot light that sweeps across turned cards is two keys on Rotate Y.

Lights show in exports and in the editor preview of a frame with a camera. The infinite canvas draws frames on the GPU and does not draw the camera stage yet, so a light does not appear there: check the result in an export or still.

| Kind | Does |
|---|---|
| ambient | Lights every layer evenly. |
| point | A bulb at x, y and depth. Dimmer with distance when `falloff` (a radius in px) is above 0. |
| spot | A point light aimed by Rotate X / Rotate Y inside a cone (`coneAngle`, softened by `coneFeather`). |
| parallel | Sun rays aimed by Rotate X / Rotate Y. Position is ignored. |

A light is a clip: it is on screen between its start and end. Colour, intensity, falloff, cone angle and cone feather take keyframes like any other property, as do its position and aim.

Each layer is shaded as a whole, by the angle between its own 3D rotation and the light (Lambert). Turn a layer with Rotate X / Rotate Y to see it catch light. Once any light is on, a layer no light reaches is black, so add an ambient light as a base.

Untick **Accepts lights** in a layer's 3D section to leave it as drawn. 3D clips keep their own lighting. Lights show in the editor preview and in exports.

## From an agent, MCP or CLI

`set_stage_light` adds a light (omit `clip_id`, the frame needs a camera) or changes one (pass the light's `clip_id`). Angles are degrees, `x`/`y` are pixels from the frame centre, `depth` is pixels behind the focus plane (negative is in front of the layers).

```bash
feega motion tool <nodeId> set_stage_light --input '{"kind":"spot","x":-300,"y":-200,"intensity":1,"cone_angle":40,"cone_feather":0.4,"aim_y":-20}'
```

The answer holds the light's `clip_id`. Animate it with `set_keyframes`, props `rotateY`, `x`, `intensity`, `color`, `falloff`, `coneAngle`, `coneFeather`. `set_clip_depth` with `accepts_lights: false` keeps one layer out of the lighting.
