# Compositor limit and core-frame regressions

**Compositor limit (`packages/gpu-core`).** The blank frame of #1091 was Vello's fixed bump
buffers (`vello_encoding::BufferSizes`, hand-picked, not configurable in 0.11): on overflow the
fine stage draws nothing. The overflow came from `scene.rs::build_items` pushing one scissor clip
per item; each clip layer writes per-tile commands over the whole frame, so ~1500 dashes inside a
frame scissor filled `ptcl`. Consecutive items with the same scissor now share one clip
(`SharedScissor`). Test: `tests/render.rs::thousands_of_dashes_in_one_frame_still_draw` (3000
items, red before). Not done: a guard on Vello overflow itself; thousands of *distinct* clips can
still hit it.

**Core-frame e2e specs failing on dev.** They were written for the DOM inline editor
(`selection-box`, `editor-stage`, `[data-frame-stage]`); #1059 made core the default. Ported to
`frame-overlays`/`frame-selection`. Real bugs found and fixed in `GpuFlow.svelte`:

- Delete with children picked deleted the frame node; now deletes the picks (`deletePicks`).
- A just-drawn element never opened its properties: its doc fetch 404'd (revision not written
  yet) and was never retried; now retried with backoff, and the own-clip entry waits for the doc.
- The align bar sat under the bottom add bar (`alignSide` in `frame-tools.ts`: below, right,
  above).
- Frame saves in flight were lost on reload; `beforeunload` now flushes and warns
  (`FrameEditSession.unsaved`).

Open: a text made by click (auto width) is not pickable on core, so it cannot be double-clicked to
type (`canvas-frame-text-typing.spec.ts` stays red as its guard). `canvas-free-*` specs still
target the DOM editor.
