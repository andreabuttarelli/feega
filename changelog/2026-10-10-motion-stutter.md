# Motion export: UI flicker, zoom-through pop, 5x faster frames

**Before.** The v2 agent trailer stuttered. Measured frame by frame (mean abs diff per frame pair,
`scripts/motion-smoothness.ts`): 12 jolts.

- **UI flicker (4.6 s, 10.9 s, 20 s).** With 4 export lanes, frames alternated between two UI
  sizes. UI kit pieces read `root.clientWidth` once at mount; the clip root was `#root{width:100%}`,
  so a lane whose iframe had no size yet at boot fell back to the design width and drew the UI
  1.33x larger. 1 lane was smooth, 4 lanes flickered.
- **Zoom-through stop (3.5 s, 10.5 s, 18.5 s).** A junction extends the outgoing clip past the cut,
  but a Precomp past its composition's end is empty: the title vanished at peak speed.
- **Export time.** 15 min for 29.6 s vertical. Cost was flat per shot (~630 ms: 235 serialize,
  390 paint) whatever the scene: html-to-image cloned and painted the 24 of 28 clip layers the
  player had hidden. Lanes gave no speed-up in Chromium (same renderer thread). Motion blur doubles
  the shots.

**Now.**
- `#root` always carries the doc size in px (`compose.ts`), so layout exists before the player
  sizes its iframe: fixes old docs whose kit source is baked in.
- Kit pieces refit the stage and the cursor read the frame on every update (`kit.ts`).
- `withJunctions` sets `hold` on an outgoing Precomp, so it keeps its last frame through the junction.
- The capture skips `.clip` layers with `visibility:hidden` (`off-stage.ts`): 655 → 115 ms/frame
  per shot on 1 lane, full v2 at 4 lanes 623 → 149 ms/frame; pixels equal (mean frame diff 0.007/255).
- `motionJolts` (`smoothness.ts`): pops, dead stops and flickers in a per-frame series; cuts without
  a junction are excluded. Not wired into the agent gate: `view_frames` samples sparse frames, the
  metric needs every frame.
- `bench:export --range=a,b` renders a frame window.

Discarded: a runtime that unhides display:none ancestors at component mount (did not help: the
zero size came from the iframe, not `display`).
