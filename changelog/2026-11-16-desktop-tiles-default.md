# Canvas: desktop gestures draw from tiles again

Direct gesture rendering (PR #2223) became the desktop default after a bench at a 60 Hz
cadence. At 120 Hz it regressed (dev 83acfdc29, presented frames from the trace, production
build, same session):

- real-sites canvas zoom 118–120 → 90–95 fps (tiles with `?directZoom=0`: 108–115);
- real-sites canvas pan 119.6–119.9 → 102–104 fps (tiles: 119.1–119.7);
- user canvas copy zoom 118.5–119.5 → 112–114 fps.

The slow frames are held-scene rebuilds (`direct_frame` → `build_held_scene`, 114–173 ms with
vsync). The guard missed them because it times `frame()` CPU cost over the first 120 gesture
frames only.

`DIRECT_BY_DEVICE` now picks tiles for every device class; `?directZoom=1` still forces direct.
The direct path, the switch and the guard stay in the code. The public changelog entry
"Sharp zoom on desktop" was never released to main and is removed, since it no longer holds.
Details in `docs/design/direct-gesture-zoom.md`.
