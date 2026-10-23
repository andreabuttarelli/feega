# Components in the Assets panel

Components lived inside the frame that made them: to reuse one in another frame you had to copy
and paste an instance or rebuild it.

- Assets tab lists the main components on the canvas (variant sets grouped, one row per
  variant). Source: every frame's live doc, published by `GpuFlow` to `canvas-components.svelte.ts`
  (`componentGroups`, one row per main even after copies exist in other frames).
- A row drags (`component-drag.ts`) onto any frame: `GpuFlow.dropComponent` finds the frame under
  the pointer and `placeInstance` adds an instance there, copying the main (and nested mains,
  assets) once when the frame does not have it, positioned where it was dropped.
- MCP: `component` action `place` adds an instance of a main already in the frame. Across frames
  the canvas drag is the only path for now.
- Not done: a copied main is not kept in sync with the original frame's main.
