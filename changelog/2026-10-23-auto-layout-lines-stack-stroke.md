# Auto layout: wrapped lines, stacking, strokes in layout (AL-03, AL-05, AL-06)

Three fields on `autoLayout`, all in the schema, the engine, Properties and `set_auto_layout`.

- `alignContent` auto | space-between (AL-03): `LINE_GAP` table in `auto-layout.ts`; the lines are
  measured first, then the free cross space is shared between them. Fewer lines than room only.
- `firstOnTop` (AL-05, default false): draw order is the track order, so the layout order never
  decided z. `layout/stacking.ts` `withStacking` permutes the tracks that hold the children, in the
  derived doc only (compose `shownDoc`, which the GPU `prepare` also goes through). The doc, the
  layers panel and the timeline keep the real order. Skipped when two children share a track.
- `strokesIncluded` (AL-06, default true): inside strokes of the container add to its padding
  (`strokeInset` in `resolve.ts`, per side for rectangles). Existing docs with an inside stroke on
  a container move their children inwards on the next draw; set false to keep the old layout.
- Checked in Chromium on test@dazero.co: `~/Documents/feega-videos/e2e/r7-polish-*.png`,
  `r7-stacking-*.png`.
