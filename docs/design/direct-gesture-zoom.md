# Direct gesture rendering (prototype)

## Problem

During a pinch or wheel zoom the core shows cached 256 px tiles. A level coarser than the zoom
is shown magnified, which blurs. ADR 0039 adds a scene fallback and crossfades, and that shows
one-frame vanishes.

## Change

Behind a flag (`?directZoom=1`, or `localStorage['feega:directZoom']='1'`), a gesture frame
skips tiles and draws the visible scene natively at the current camera:

1. `tiles::path_for` gains `Path::Direct`, picked when `GestureDraw::Direct` is set and the
   moment is a gesture (or settling), never while layers are lifted (drag keeps tiles).
2. `WebCore::direct_frame` plans the screen at the camera (`Compositor::plan_at`), the same
   plan the exact rest path uses, so vector groups compose their cached vello encodings
   (`Fragments` / `compose`) with the camera matrix. Encodings don't depend on zoom; only the
   transform changes.
3. The frame is drawn into one screen texture, presented with the overlay, and, when nothing is
   pending, copied into `retained` and adopted. The first still frame after the gesture is then
   already sharp: no settle pass, no swap, nothing to crossfade.
4. `CoreFrames` reads the flag (`direct-switch.ts`) and calls `setDirectGesture`.

Tiles, the pyramid, the warmup and the exact path are untouched. With the flag off nothing
changes.

## Not built yet

The design keeps cached textures only for content whose cost scales with area: blurs,
backdrops, mattes and big images, held at the next finer level so they are downsampled, never
magnified. The prototype redraws effect layers every frame through `layers::prepare`. The
existing layer cache is keyed on screen geometry, so it misses on every zoom step. The bench
below shows how much that costs.
