---
title: Editor modes
description: Design, Motion, Play and Code — one switch in the bottom bar decides what your edits do.
sidebar:
  order: 13
---

The switch at the left of the bottom bar sets one mode for the whole editor. Feega remembers it in your browser.

| Mode | What it does | Key |
|---|---|---|
| **Design** | Edits set the resting state of a layer. Editing an animated property shifts its whole animation, curve shape kept, with a notice. `⌘J` opens the timeline to scrub, read-only. | `E` toggles with Motion |
| **Motion** | Recording: a red border marks the canvas and the properties bar. Edits create or move a keyframe at the playhead; the ◇ next to a property toggles its keyframe. The timeline opens on video frames; `⌘J` hides it. | `E` |
| **Play** | Connect and try: [prototype links](/canvas/prototype-links/) drawn as arrows, node lines hidden. The right panel holds the link, Prototype flow (Play, Copy play link), Play on canvas and Interactive. | — |
| **Code** | Read a layer as CSS or Tailwind, export the frame as React, HTML or Svelte. Nothing can be edited. See [Code mode](/canvas/dev-mode/). | `Shift+D` |

- `E` switches between Design and Motion; from Play or Code it goes back to Design.
- `Shift+D` enters Code; pressed again it goes back to Design.
- Play starts the player on the frame you are in, or the one frame selected.
- Stills always edit in Design: Motion applies to frames that have a timeline.

## Recording in Motion

- **Drag, resize, rotate on the canvas** key the change at the playhead. A layer that was not animated starts a track: its value stays at its first frame and the new one lands at the playhead. The anchor point is never keyed.
- **Drawing** a new layer in Motion sets its resting values, with no keyframes. It starts at the playhead.
- **Motion path**: select one layer whose position is animated and its path shows on the canvas, one tick per frame.
- **Onion skin**: turn it on with **Onion skin** in the timeline bar. The selected layer shows as faint outlines at its previous and next keyframes.
- **Voice-over and music**: with nothing selected, the right panel has a Sound row with **Voice-over…** and **Music…**. They are also in the node's **…** menu.

The mode used to live in a row at the top of each frame's properties. That row is gone: the bottom-bar switch replaces it, for every frame at once.
