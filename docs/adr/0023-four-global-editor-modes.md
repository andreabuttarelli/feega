# Four global editor modes: Design, Motion, Play, Code

Status: accepted 2026-10-29. Spec: [`docs/specs/editor-modes.md`](../specs/editor-modes.md).

## Decision

- The canvas header has one global mode control: Design · Motion · Play · Code (mobile: bottom
  pill). Each mode has one verb: build, record time, connect & try, read & export.
- Motion is a recording state: property edits keyframe at the playhead, signalled by a coloured
  border. Design edits base values; editing an animated property shifts its animation.
- Play shows prototype arrows and hides node connection lines. Code is read-only.
- The add bar becomes one "+" insert menu. The left panel becomes Pages + Layers.
- No feature lives only in the "…" menu or a frame overlay.

## Why

Features were scattered across eight surfaces, several reachable from one hidden menu only, and
shortcuts collided across the canvas and motion tables. A mode per verb gives every feature one
obvious home.

## Rejected

- Per-frame modes (today's frame mode row): mode is the user's intent, not a property of a frame.
- Keeping Design/Generate in the add bar: a second mode axis next to the global one.
