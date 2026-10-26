# Core canvas: per-group encoded scene cache, live vector redraw while zooming

Before: while zooming, the core canvas reprojected the last retained image and refined at rest,
because rebuilding every group's items (clone + matrix per item, vello encoding) cost more than a
frame on a heavy frame.

Now a group made only of paths (no blur, mask, matte, filter, backdrop, picture or text) is
encoded once into a `vello::Scene` in its own coordinates, kept by `Library` and dropped on
`put_group` / `append_group` / `drop_group`. The plan emits a `use` and the engine appends the
cached scene under the use matrix (`Scene::append` with a transform). Zoom and pan re-encode
nothing. `cache: true` is ignored for these groups: they are always vector.

`Retained` redraws a zoom gesture frame sharp and live while the last full render took at most
10 ms (`LIVE_FULL_MS`); above that it falls back to reprojecting the retained image as before.
`WebCore` turns composing on; the native renderer does so only on request, so existing paths and
tests are unchanged.

Native bench (`cargo run --release --example zoom_cost`, 120 groups x 150 paths, 90 zoom frames,
plan + encode + render + GPU wait): p50 11.1 ms -> 6.7 ms, p95 39.0 ms -> 20.2 ms.

Not changed: groups with pictures, text, layers or lenses still go through the old path and the
cache textures.
