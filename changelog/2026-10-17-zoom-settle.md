# Canvas LOD and live tiles apply only after the gesture settles

Production (4bf98e53) zoom lagged badly. #681 flipped the poster LOD on
every viewport update; #697 then mounted/unmounted live tile players as
IntersectionObserver fired mid-gesture. Both reflowed dozens of nodes per
frame.

Now `lodGate` (`canvas-lod.svelte.ts`) marks the viewport `moving` on each
update and applies `lodNext` once, `LOD_SETTLE_MS` (150 ms) after the last
one. `MotionNode` keeps a `settledSight` that follows `sight` only when not
moving, so the live-tile queue and player mounts stay frozen during the
gesture. #697's structure (cap, queue, hysteresis) is unchanged.

Discarded: a straight revert of #681 (conflicts with #697). Pausing a
player the user started: playback is user intent, left untouched.
