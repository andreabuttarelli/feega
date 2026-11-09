# A frame drag moves textures, not pages

While a frame (with its responsive views) is dragged, every frame on screen is held as a cached
texture (`heldWhileMoving`), so each move recomposites textures instead of re-rendering imported
pages, their masks and backdrop layers.

Two core changes make the hold effective: a held use no longer takes the pre-encoded-scene
shortcut that bypassed the texture cache (`moved_as_texture` in `groups.rs`), and a held texture
is rastered whole in one plan instead of 48 items per frame, so the drag goes live-to-texture in
one frame. Both pinned in `packages/gpu-core/tests/cache.rs`.

Discarded: holding only the dragged frame. A/B showed it slower than not holding at all (the
damage region still re-rendered the live neighbours, plus the extra texture build).
