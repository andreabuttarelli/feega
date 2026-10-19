# gpu-core keeps canvas frames as groups; the screen list only places them

For the infinite canvas (ADR 0020). `canvasScene` folds the camera into every item in TS, so each
pan re-serialised every visible frame's list to JSON and the core re-parsed it. Now a frame's
list is put once (`putGroup(key, list)`), and the screen list holds `use` items
(`{ kind: 'use', clip, group, matrix }`). The core expands a `use` the way `canvasScene` places a
frame: matrix into items, masks, mattes and space; blur and feather scaled; frame rect as scissor;
background as a rect (`groups.rs`). Missing groups are reported, not drawn.

Same on WebGPU, WebGL2 and native. API written into ADR 0020. Next: `cache: true` to keep a still
frame as a texture at its on-screen scale, once the canvas agents measure where time goes.
