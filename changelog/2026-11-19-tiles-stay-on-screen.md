# Tiles on screen are never evicted

**Why.** Users saw images vanish and areas turn blurry on big canvases. Screenshot
probes never caught it. A new in-core watcher (`window.__gpuCanvas.losses`) did:
on a one-minute wander over the heavy canvas copy, hundreds to ~1,900 drawn
tiles per run were evicted while on screen, worst with the phone budget.

**Before.** `Tiles::evict_beyond` pinned only the current level near the
camera, the plan and the overview. Tiles of other levels still being painted
(the finer ones kept after a zoom out, the `beneath` underlay) were fair game.

**Now.** Any tile painted in the last frame, `draw` or `beneath`, is pinned.
After the fix: zero evictions of drawn tiles and zero losses at a still camera
on desktop, CPU 4× and phone budget.

**Kept.** During a gesture the engine still stretches one whole level, which
the watcher logs as coarser: that is the deliberate trade against a patchwork
of sharp and soft tiles (`a_gesture_frame_draws_one_whole_level_…`).

**Discarded.** Letting gestures fall back to the mixed draw: it brought the
patchwork back.
