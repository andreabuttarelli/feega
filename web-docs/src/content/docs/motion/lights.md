---
title: Lights
description: Light the flat layers of the camera world.
sidebar:
  order: 5
---

Lights shade the flat layers of a video that has a camera. Add one in the frame Properties, under **Lights**, or ask the agent (`set_stage_light`).

| Kind | Does |
|---|---|
| ambient | Lights every layer evenly. |
| point | A bulb at x, y and depth. Dimmer with distance when `falloff` (a radius in px) is above 0. |
| spot | A point light aimed by Rotate X / Rotate Y inside a cone (`coneAngle`, softened by `coneFeather`). |
| parallel | Sun rays aimed by Rotate X / Rotate Y. Position is ignored. |

A light is a clip: it is on screen between its start and end. Colour, intensity, falloff, cone angle and cone feather take keyframes like any other property, as do its position and aim.

Each layer is shaded as a whole, by the angle between its own 3D rotation and the light (Lambert). Turn a layer with Rotate X / Rotate Y to see it catch light. Once any light is on, a layer no light reaches is black, so add an ambient light as a base.

Untick **Accepts lights** in a layer's 3D section to leave it as drawn. 3D clips keep their own lighting. Lights show in the editor preview and in exports.
