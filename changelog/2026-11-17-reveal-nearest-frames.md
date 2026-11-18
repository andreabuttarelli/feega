# The loading screen lifts once the nearest frames show

`CanvasLoading` stayed until `StartupStep.AllShown` (every on-screen frame drawn), or 8 s after the
engine, 12 s hard. On the 36-page stress canvas the core drew the first frames at ~2.5 s but the
splash hid them until ~9.4 s in every cold run.

`startupProgress` now also completes once the engine is ready and the six frames nearest the
centre (`NEAREST_FRAMES`, in fill order) show a poster, a thumb or vectors. `CoreFrames` reports
those counts beside the on-screen totals. The 8 s / 12 s caps stay. The owner compared both on a
build with a switch and kept this rule; the switch is not shipped.
