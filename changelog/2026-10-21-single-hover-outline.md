# One hover outline on core frames

With `unifiedFrames` on and the core renderer, the page no longer mounts the overlay `FrameHover` for core-drawn tiles; only the pick outline from GpuFlow draws. The page shares `unifiedCore` with `inlineMotionTarget`. DOM tiles keep their own FrameHover (pick skips them). Not verified in a browser: whether the pick outline itself doubles on text or grouped clips.
