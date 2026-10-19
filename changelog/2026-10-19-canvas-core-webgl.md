# `?renderer=core` works without WebGPU

The "see-through shapes" on WebKit were not a WebGL2 bug: Pixi appends its canvas after the core
layer, so Pixi's dot grid painted over core frames (visible wherever the grid shows, any backend).
The core layer now sits above Pixi and below the DOM nodes (`z-index: 1`), and `CoreFrames` falls
back from WebGPU to the core's WebGL2 backend instead of to today's canvas. A pixel probe of the
WebGL2 core on WebKit and Chromium (solid shape, group `use` at 0.05–1×) drew fully opaque.

A still doc now rests on its `still` frame, not on the 40% poster instant.

Frames that look different from `?renderer=gpu` and why: four docs on the heavy copy are empty at
their head revision (or their only clip ends before the poster instant), so the core draws their
brand background; today's canvas shows a stale poster from an older revision.
