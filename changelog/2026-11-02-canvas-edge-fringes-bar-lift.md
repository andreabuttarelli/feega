# Canvas edges without white fringes; bottom bar never slides over the timeline

From the basics audit (items 30 and 31).

**White rings and specks on shape edges (WebGPU canvas).** Vello writes its target with
straight (unpremultiplied) alpha, and the canvas surface is configured `PreMultiplied`.
`present` (and the older `draw`, through `TextureBlitter`) copied that straight texture to
the surface as is, so the browser composited every half-covered pixel as `colour + page ×
(1 − α)`: light fills came out brighter than the page (a 255 ring around ellipses) and
transparent pixels that kept a colour added faint streaks next to tiles. The
`Reprojector` now has two fragment entries: `straight` for copies between retained
textures, `premultiplied` for the last copy to the surface; `draw` uses the same pass
instead of the blitter. Gpu test: `tests/reproject.rs` (`--features gpu`). The WebGL path
(vello_hybrid) was not touched. `static/gpu-core/gpu_core_bg.wasm` rebuilt.

Seen and not fixed here: right after ⌘G, a grouped rectangle shows a 1px gap on its left
edge until reload; it survives a re-raster, so it is in the group's live doc, not the
compositor (groups are another workstream).

**Bottom bar over the timeline (Motion).** The timeline appears at once and the bar's
`bottom` animated over `--chrome-move` (360 ms), so for that time it sat on the timeline.
`liftMove` decides: lifting jumps (`data-lift="jump"` drops `bottom` from the transition),
lowering glides. A short viewport (760 px) was checked too.
