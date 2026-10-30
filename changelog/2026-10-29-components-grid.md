# Components panel: grid of real previews

Follows PR #1539.

- The panel was a vertical list whose thumbnail was the poster of the frame holding the
  component, not the component. Now a 2-column grid of tiles per canvas, one tile per variant,
  name under the preview. Drag, Copy and Show main stay on the tile (`component-row` test id kept).
- Preview path: `component-previews.ts` fetches the frame source (`/p/.../motion/{id}/source`),
  `previewDoc` keeps only the main's clip, `shownBox` crops to what it paints (path/image corners
  plus text boxes), and the still goes through `renderOnCore` — the export renderer, no new one.
  Cropped and resized with `createImageBitmap`.
- Cost: lazy (IntersectionObserver), serial queue, tile side 96 CSS px × min(dpr, budget
  resolution), LRU cache keyed `compId@revision` capped at 1/32 of the device texture budget.
- `GET /api/v1/projects/{id}/components` adds `revision` (the frame's head version) as the
  cache key. `thumb` stays in the response for API consumers.
- Discarded: SVG export (needs text shaping it skips) and the JS WebGL raster (draws no text).
