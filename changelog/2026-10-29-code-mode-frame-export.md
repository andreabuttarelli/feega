# Code mode keeps the frame export

- With a layer picked, Code mode showed only that layer's CSS. A page layer filling the frame
  made the React/HTML/Svelte export unreachable without clicking the frame title.
- The right bar now stacks `DevInspector` (layer CSS) above `DevCode` (tabs, Copy, .zip).
- `DevCode` was given `name="Frame"`: `<title>Frame</title>`, `frame-html.zip`. The real name
  now travels via `frameProperties.name`, set by `GpuFlow` from the tile's `displayName`.
- Discarded: "Export layer". `exportCode` takes a whole `MotionDoc`; no subtree root exists.
