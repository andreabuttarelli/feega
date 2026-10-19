# Frames: click selects, drag moves, double-click edits

- "Open editor" is gone from frame tiles: DOM tile (`MotionNode`), GPU card (`openPill` in `gpu/scene.ts`) and the onboarding illustrations. Opening is double-click / double-tap / Enter. GPU snapshot cache bumped to `v2` so cached cards with the old pill are not reused.
- Phone: opening the inline editor no longer reframes the canvas (`REFRAME[Phone] = Stay`). Tablet still frames.
- Desktop opens the inline editor on select, and its `SelectionOverlay` used to take the press: a click selected the inner element under the pointer, a drag moved that element. Now, for `FrameKind.Frame` at `Depth.Frame`, a press moves the whole frame through the canvas `hostDrag` (same path free elements use, save queue included). Table: `pressOf(depth, FramePress)` in `drill.ts`; per-kind value `press` in the `frameChrome` table. Elements and groups keep picking. The opening click (`pickAt`, or a `Click` asked by `FrameHover`) no longer selects an inner element either. A 4 px slop keeps a click from nudging the frame.
- Inner elements: double-click / Enter, as before. The full-page editor is unchanged (no host handler there).

Known, not touched (GPU canvas agent's area): on the GPU renderer in WebKit iPhone emulation a tap on a frame reaches no pointer handler, so it does not select. DOM renderer on phone works.
