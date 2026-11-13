# A patched frame's rebuild starts after the patch paints

The worker rebuild that replaces a fast patch was started inside the key handler (`rebuildLive` →
`liveOff` serialising the doc, about 5 ms on landings) before the patch could reach the screen.

- `paintFirst` (`src/lib/canvas/core/paint-first.ts`): per frame, the newest rebuild waits for
  `FramePacer.afterPaint`; a rebuild started now for an unpatched edit drops one still waiting, so
  an older doc never lands over a newer one.
- Unpatched edits start their rebuild immediately, as before.
