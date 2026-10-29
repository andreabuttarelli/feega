---
title: Editor modes
description: Design, Motion, Play and Code — one switch at the top of the canvas decides what your edits do.
sidebar:
  order: 13
---

The switch at the top centre of the canvas sets one mode for the whole editor. Feega remembers it in your browser.

| Mode | What it does | Key |
|---|---|---|
| **Design** | Edits set the resting state of a layer. Editing an animated property shifts its whole animation. | `E` toggles with Motion |
| **Motion** | Edits create or move a keyframe at the playhead. The timeline opens on video frames. | `E` |
| **Play** | Connect and try: [prototype links](/canvas/prototype-links/) drawn as arrows, node lines hidden. The right panel holds the link, Prototype flow (Play, Copy play link), Play on canvas and Interactive. | — |
| **Code** | Read a layer as CSS or Tailwind and export it. Nothing changes. See [Code mode](/canvas/dev-mode/). | `Shift+D` |

- `E` switches between Design and Motion; from Play or Code it goes back to Design.
- `Shift+D` enters Code; pressed again it goes back to Design.
- Play starts the player on the frame you are in, or the one frame selected.
- Stills always edit in Design: Motion applies to frames that have a timeline.

The mode used to live in a row at the top of each frame's properties. That row is gone: the header switch replaces it, for every frame at once.
