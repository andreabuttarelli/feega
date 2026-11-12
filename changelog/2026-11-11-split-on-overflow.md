# Engine: split a tile render that overflows vello's buffers

vello sizes its bump buffers once (`vello_encoding/src/config.rs`: lines/segments 2^21, tiles 2^22,
ptcl 2^23) and drops what does not fit without reporting it: the tile comes out blank or partial
(#1063 mitigated it by capping renders at 1024 px). Now `raster_batch` renders the batch through
`tiles::split_render`: when the encoded scene's bump estimate (`bump_estimate` feature,
`engine::overflows`) exceeds those sizes, the region is halved along its longer side and each half
is planned and drawn on its own, recursively, at most 12 halvings (Graphite's `vello_render.rs`).
Tiles copy from every piece they overlap. A render that fits is unchanged: one piece, the pooled
atlas.

The estimator costs nothing measurable in encoding (`examples/zoom_cost.rs`, p50 2.9 vs 2.9 ms and
1.6 vs 1.6 ms). Only the main scene of a tile batch is checked; an overflowing layer body or a
non-tiled screen frame is not split.
