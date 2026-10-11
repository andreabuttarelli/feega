# Motion videos loop by default

**Why.** User rule (2026-10-11): wherever possible a video loops seamlessly — the end flows back
into the start. Embeds and social autoplay replay it, so a hard jump at the seam shows every time.

**Before.** The embed already looped (`loop: true` written twice, in `DEFAULT_INTERACTIVE` and in
the zod default), but nothing planned a loopable ending or checked the seam, except the
ui-morph reel's own `loop-seam` gate.

**What.**

- `style-model.ts`: `HOUSE_LOOP = true`, next to `DEFAULT_STYLE`; both interactive defaults read it.
- `loop.ts`: one table, `ENDINGS`, says which videos must loop seamlessly and which are
  exceptions: looping turned off, scrub playback, the ui-morph reel (its own blocking gate), a
  last frame on the `end-card` template. `loopJump` turns a seam measure into a fix.
  `LOOP_RULE` goes into every role's prompt: end on the opening state or a match cut to frame 0.
- `smoothness.ts` `seamDiff` + `frame-stats.ts` `seamLuma`: mean luma step from the last frame
  to the first, on 64×64 greyscale. `view_frames` draws frames 0 and end−1 when the ending is
  checked; ≥ 12 adds `Quality.LoopJump`, severity Warning — never blocking.

**Discarded.** A structural check (same clips on the first and last frame): it passes a cut to
a different layout of the same clips and fails a match cut between different clips.
