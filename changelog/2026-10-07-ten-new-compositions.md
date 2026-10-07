# Seven new compositions on the motion engine

**Why.** The composition gallery had eleven layouts; the user asked for more media loops in
an Apple-keynote register: calm, square to the frame, no PowerPoint effects.

**What.**
- `src/lib/canvas/composition/`: `marquee`, `stack`, `perspective-wall`,
  `film-strip`, `split-reveal`, `polaroid`, `masonry`. Pure pose
  functions; shared helpers in `loop.ts` (wrap, smoothstep, held steps with the house
  `easeInOutExpo`, seeded jitter, frame size).
- New motion mode `linear` (`MOTION_TIME` table in `motion.ts`): constant pace for endless
  loops; step layouts hold, then glide. `pose.ts` reads the table instead of a ternary.
- `fit` in the layout table replaces the `explorer-grid` special case in `activeParams`:
  marquee, split reveal and masonry size themselves to the frame aspect.
- Templates `builtin:composition-<layout>`, agent fields and the gallery come from `LAYOUTS`,
  so parity tests cover the new ones with no extra wiring.
- `render-cost.ts`: `LAYOUT_FRAME_MS`, per-layout WebGL ms per frame. Before, a WebGL
  composition was priced as flat. Numbers from a 8 s 1080×1920 farm render per layout, ten
  sandboxes in parallel (noisy, ±30%): 0.5–1.8 s per frame on one vCPU.
- `media-loops.test.ts`: determinism, closed loop, media on screen in 9:16, 1:1, 16:9, resting
  cards wholly in frame, endless wraps out of sight.

**Not done.** Nested motion still reaches WebGL layouts as its poster image; live comps play
only in ring and bento. Composition is still `RenderClass.Flat` in `render-quote.ts` (1 vCPU).

**Discarded.** Taking easings from the Apple-minimal branch (PR #182): not merged, and its
eases are keyframe beziers for scenes; layouts already share `easeInOutExpo`.

Parallax, globe and zoom tunnel were built and rendered, then dropped after review: crowded,
sparse or overlapping frames.
