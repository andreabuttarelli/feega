# Still design frames take any size

A still frame (page, post, mockup) was held to the video cap (short side 1080, long side 1920),
so a 1440×6000 landing page was refused. `fitsResolution` now reads the doc mode: a still takes
1–16384 px a side (GPU texture limit); a video keeps the 1080p rule. A still past the video cap
cannot be turned back into a video (`setStill(null)` refuses with the reason). `set_canvas`
applies `still` before the size, so one call makes a tall page. The inspector size fields take
their range from `sideRange`, the same rule.

Not done: tiled/downscaled GPU preview for huge frames; a scale option on video export.
