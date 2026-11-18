# Backdrop and blend layers encode only what lies under them

A coarse tile on the landings wall (33 pages, 15k layers) cost 50–90 ms,
worst ~200 ms. A CPU profile of the zoom bench put almost all of it in
`layers::prepare_items`: per backdrop item (glass nav bars, one or more
per page) `behind` encoded **every item before it in the tile** to paint
the region under it, then rendered only that small region. At overview a
tile holds many pages, so the cost grew with backdrops × items.

- `behind` and `composited` now build only the items whose reach (bounds
  inflated by blur, mask feather and filter reach; unbounded kept)
  overlaps the painted region, via `scene::build_where`.
- Reaches are measured once per `prepare_items` call, not per backdrop:
  measuring them per backdrop cost ~1 s of the 4.4 s profile on its own.

Measured with the headed zoom bench (`~/Documents/feega-videos/perf/sharp-zoom`).
Not done: layer bodies and masks (the other half of coarse cost) still
pay one vello render each.
