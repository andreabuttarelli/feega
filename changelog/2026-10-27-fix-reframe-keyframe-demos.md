# Frame mode label and the reframe and keyframe demos

Two defects found while re-recording the reframe and keyframe demos.

**Mask polarity.** Found independently here and in #1448 (merged first, kept): Ideogram v3 edit repaints the black part of the mask. The unchanged grey strips were the "empty" new node. Confirmed with a real reframe 4:5 on `kie/ideogram/v3-edit`.

**Frame edit mode label.** The timeline read `savers.get(nodeId)?.mode` from a plain `Map`: never
reactive, so it showed the `FrameTimeline` default (Motion) while the session started in Design,
and the toggle never changed the label. Typing a size on an animated prop then shifted the
single key instead of adding one at the playhead. `shownMode` now gives the start mode until the
frame is toggled, and the session reports toggles through `moded`.

**Demos.** `reframe.demo.ts` used a source clip that did not exist and the old toolbar path
(Reframe is now in the more-actions menu); it now reframes a real clip and runs one real image
reframe, skipping the wait with `d.skip`. `t5-keyframe-coverage.demo.ts` never clicked the
diamond; it now keys width and height three times and plays the result.
